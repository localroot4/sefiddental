// Lighthouse CI in both themes (light, then LHCI_THEME=dark; docs/brief.md asks for both) and
// the LCP spread of every URL. The gate stays in lighthouserc.cjs: the median of 5 runs against
// the 2500 ms target. Simulated LCP on the 404 template varies between runs (1359-2121 ms on the
// container), so every run prints min, median and max beside the limit instead of loosening it.
// Lighthouse loads the pages over HTTPS and HTTP/2 through scripts/tls-front.mjs, as browsers
// reach production; the certificate is a throwaway one that only this Chrome trusts.
//   node scripts/lhci.mjs        (after `npm run build` and `npm run db:e2e`; CHROME_PATH set;
//                                 needs the openssl CLI)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lhciDir = path.join(root, '.lighthouseci');

const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * LCP and total-blocking-time statistics per requested URL (pure, unit-tested).
 * @param {{ requestedUrl: string, audits: Record<string, { numericValue?: number }>, categories: Record<string, { score: number | null }> }[]} lhrs
 * @param {{ matchingUrlPattern: string, assertions: Record<string, unknown> }[]} assertMatrix
 */
export function lcpSpread(lhrs, assertMatrix) {
  const byUrl = new Map();
  for (const lhr of lhrs) {
    const lcp = lhr.audits['largest-contentful-paint']?.numericValue;
    if (typeof lcp !== 'number') continue;
    const entry = byUrl.get(lhr.requestedUrl) ?? { lcp: [], tbt: [], performance: [] };
    entry.lcp.push(lcp);
    const tbt = lhr.audits['total-blocking-time']?.numericValue;
    if (typeof tbt === 'number') entry.tbt.push(tbt);
    entry.performance.push(lhr.categories.performance?.score ?? 0);
    byUrl.set(lhr.requestedUrl, entry);
  }
  return [...byUrl.entries()].map(([url, { lcp, tbt, performance }]) => {
    const sorted = [...lcp].sort((a, b) => a - b);
    const tbtSorted = [...tbt].sort((a, b) => a - b);
    const assertions =
      assertMatrix.find((m) => new RegExp(m.matchingUrlPattern).test(url))?.assertions ?? {};
    const rule = assertions['largest-contentful-paint'];
    const tbtRule = assertions['total-blocking-time'];
    const [level, options] = Array.isArray(rule) ? rule : [rule, {}];
    const limitMs = options?.maxNumericValue ?? null;
    const medianMs = median(sorted);
    return {
      url,
      runs: sorted.length,
      minMs: Math.round(sorted[0]),
      medianMs: Math.round(medianMs),
      maxMs: Math.round(sorted.at(-1)),
      spreadMs: Math.round(sorted.at(-1) - sorted[0]),
      runsOverLimit: limitMs === null ? 0 : sorted.filter((v) => v > limitMs).length,
      limitMs,
      level: level ?? 'off',
      medianPasses: limitMs === null || medianMs <= limitMs,
      tbtMinMs: tbtSorted.length ? Math.round(tbtSorted[0]) : null,
      tbtMedianMs: tbtSorted.length ? Math.round(median(tbtSorted)) : null,
      tbtMaxMs: tbtSorted.length ? Math.round(tbtSorted.at(-1)) : null,
      tbtLimitMs: (Array.isArray(tbtRule) ? tbtRule[1]?.maxNumericValue : null) ?? null,
      performanceMedian: median([...performance].sort((a, b) => a - b)),
    };
  });
}

/** Markdown table of one theme's rows. */
export function spreadTable(theme, rows) {
  const lines = [
    `### LCP spread, ${theme} (median gates; ${rows[0]?.runs ?? 0} runs per URL)`,
    '',
    '| URL | Runs | Min ms | Median ms | Max ms | Spread ms | Runs over limit | Limit ms (level) | Median | TBT median ms (min to max) | TBT limit ms | Perf. median |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${new URL(r.url).pathname}${new URL(r.url).search} | ${r.runs} | ${r.minMs} | ${r.medianMs} | ${r.maxMs} | ${r.spreadMs} | ${r.runsOverLimit} | ${r.limitMs ?? 'none'} (${r.level}) | ${r.medianPasses ? 'pass' : 'FAIL'} | ${r.tbtMedianMs ?? '-'} (${r.tbtMinMs ?? '-'} to ${r.tbtMaxMs ?? '-'}) | ${r.tbtLimitMs ?? 'none'} | ${r.performanceMedian} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

/**
 * Lighthouse's suggested CPU slowdown for a mid-tier mobile target, by host class (table in
 * lighthouse/docs/throttling.md): a high-end desktop (benchmarkIndex 1500 and up) 4x, a slower
 * host 2x. The same budgets then mean the same phone on a fast laptop and on a CI runner.
 */
export function cpuMultiplierFor(benchmarkIndex) {
  return benchmarkIndex >= 1500 ? 4 : 2;
}

/** Median benchmarkIndex of a short collect run on this host (NaN if it could not run). */
function measureHost() {
  rmSync(lhciDir, { recursive: true, force: true });
  // Three runs per URL: one reading of the same host ranged 1514-2264, and 1500 is a step.
  spawnSync('npx', ['lhci', 'collect', '--numberOfRuns=3'], { cwd: root, stdio: 'inherit' });
  let index = Number.NaN;
  try {
    const values = savedLhrs()
      .map((lhr) => lhr.environment?.benchmarkIndex)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (values.length) index = median(values);
  } catch {
    // collect failed before writing a report; the default multiplier applies
  }
  rmSync(lhciDir, { recursive: true, force: true });
  return index;
}

/**
 * A one-day self-signed certificate for localhost and its SPKI pin: Chrome trusts exactly this key
 * through --ignore-certificate-errors-spki-list (lighthouserc.cjs), so the page counts as secure.
 */
function localCertificate(dir) {
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  const args =
    'req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 1 -subj /CN=localhost';
  try {
    execFileSync(
      'openssl',
      [...args.split(' '), '-addext', 'subjectAltName=DNS:localhost', '-keyout', key, '-out', cert],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
  } catch (error) {
    throw new Error(
      `lhci: could not create the local TLS certificate with the openssl CLI (${error.message}). Install OpenSSL 1.1.1 or later and run again.`,
    );
  }
  const spki = new X509Certificate(readFileSync(cert)).publicKey.export({
    type: 'spki',
    format: 'der',
  });
  return { key, cert, pin: createHash('sha256').update(spki).digest('base64') };
}

/** Starts scripts/tls-front.mjs and resolves once it listens. */
function startTlsFront(tls, listenPort, upstreamPort) {
  const front = spawn(
    process.execPath,
    [path.join(root, 'scripts', 'tls-front.mjs'), tls.key, tls.cert, listenPort, upstreamPort],
    { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  return new Promise((resolve, reject) => {
    front.once('error', reject);
    front.once('exit', (code) => reject(new Error(`tls-front exited with code ${code}`)));
    front.stdout.once('data', (line) => {
      process.stdout.write(line);
      front.stdout.resume();
      resolve(front);
    });
  });
}

function savedLhrs() {
  return readdirSync(lhciDir)
    .filter((name) => /^lhr-\d+\.json$/.test(name))
    .map((name) => JSON.parse(readFileSync(path.join(lhciDir, name), 'utf8')));
}

/** One GitHub annotation per failed error-level assertion: CI logs are not always readable. */
function annotateFailures(theme) {
  let results = [];
  try {
    results = JSON.parse(readFileSync(path.join(lhciDir, 'assertion-results.json'), 'utf8'));
  } catch {
    return; // autorun failed before asserting; its own output says why
  }
  for (const r of results) {
    if (r.passed || r.level !== 'error') continue;
    const what = r.auditProperty ? `${r.auditId}.${r.auditProperty}` : r.auditId;
    console.log(
      `::error title=lhci ${theme}::${r.url} ${what} ${r.name}: expected ${r.operator} ${r.expected}, got ${r.actual} (runs ${JSON.stringify(r.values)})`,
    );
  }
}

async function main() {
  // Local runs read the repo .env (CHROME_PATH for the container Chromium), like
  // check-bundle.mjs and playwright.config.ts; shell values win; CI has no .env.
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  // The key never outlives the run, whatever fails.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lhci-tls-'));
  let front;
  try {
    const tls = localCertificate(dir);
    process.env.LHCI_TLS_PORT ??= '3443';
    process.env.LHCI_TLS_PIN = tls.pin;
    front = await startTlsFront(tls, process.env.LHCI_TLS_PORT, process.env.E2E_PORT ?? '3000');
    run();
  } finally {
    front?.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

function run() {
  // The assertions do not depend on the theme (only the Chrome flags and the report folder do).
  const require = createRequire(import.meta.url);
  const { assertMatrix } = require('../lighthouserc.cjs').ci.assert;
  const { tbtTargetMs } = require('../tests/budgets/limits.json').classes.content;
  // A multiplier set in the shell wins (to reproduce a run); otherwise calibrate on this host.
  const index = process.env.LHCI_CPU_MULTIPLIER ? Number.NaN : measureHost();
  const multiplier =
    process.env.LHCI_CPU_MULTIPLIER ?? String(Number.isFinite(index) ? cpuMultiplierFor(index) : 4);
  const host = `Host benchmarkIndex ${Number.isFinite(index) ? Math.round(index) : 'not measured'}; CPU slowdown ${multiplier}x.`;
  console.log(`lhci: ${host}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=lhci host::${host}`);
  // The targets stay visible beside the interim TBT limit the gate uses (docs/brief.md section 7).
  const sections = [
    host,
    `Content-page TBT target ${tbtTargetMs} ms; CI gates the TBT limit below.`,
    '',
  ];
  let failed = false;
  for (const theme of ['light', 'dark']) {
    const env = {
      ...process.env,
      LHCI_THEME: theme === 'dark' ? 'dark' : '',
      LHCI_CPU_MULTIPLIER: multiplier,
    };
    const run = spawnSync('npx', ['lhci', 'autorun'], { cwd: root, env, stdio: 'inherit' });
    if (run.status !== 0) failed = true;
    if (run.status !== 0 && process.env.GITHUB_ACTIONS) annotateFailures(theme);
    let lhrs = [];
    try {
      lhrs = savedLhrs();
    } catch {
      // No .lighthouseci folder: collect failed before the first run; autorun already said why.
    }
    const table = spreadTable(theme, lcpSpread(lhrs, assertMatrix));
    console.log(`\n${table}`);
    sections.push(table);
  }
  mkdirSync(lhciDir, { recursive: true });
  writeFileSync(path.join(lhciDir, 'lcp-spread.md'), sections.join('\n'));
  if (failed) {
    console.error('lhci: at least one theme failed its assertions (see above).');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
