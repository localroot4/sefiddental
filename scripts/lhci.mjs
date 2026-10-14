// Lighthouse CI in both themes (light, then LHCI_THEME=dark; docs/brief.md asks for both) and
// the LCP spread of every URL. The gate stays in lighthouserc.cjs: the median of 5 runs against
// the 2500 ms target. Simulated LCP on the 404 template varied 1824-2817 ms on the container, so
// every run prints min, median and max beside the limit instead of loosening it.
//   node scripts/lhci.mjs        (after `npm run build` and `npm run db:e2e`; CHROME_PATH set)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lhciDir = path.join(root, '.lighthouseci');

const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * LCP statistics per requested URL (pure, unit-tested).
 * @param {{ requestedUrl: string, audits: Record<string, { numericValue?: number }>, categories: Record<string, { score: number | null }> }[]} lhrs
 * @param {{ matchingUrlPattern: string, assertions: Record<string, unknown> }[]} assertMatrix
 */
export function lcpSpread(lhrs, assertMatrix) {
  const byUrl = new Map();
  for (const lhr of lhrs) {
    const lcp = lhr.audits['largest-contentful-paint']?.numericValue;
    if (typeof lcp !== 'number') continue;
    const entry = byUrl.get(lhr.requestedUrl) ?? { lcp: [], performance: [] };
    entry.lcp.push(lcp);
    entry.performance.push(lhr.categories.performance?.score ?? 0);
    byUrl.set(lhr.requestedUrl, entry);
  }
  return [...byUrl.entries()].map(([url, { lcp, performance }]) => {
    const sorted = [...lcp].sort((a, b) => a - b);
    const rule = assertMatrix.find((m) => new RegExp(m.matchingUrlPattern).test(url))?.assertions[
      'largest-contentful-paint'
    ];
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
      performanceMedian: median([...performance].sort((a, b) => a - b)),
    };
  });
}

/** Markdown table of one theme's rows. */
export function spreadTable(theme, rows) {
  const lines = [
    `### LCP spread, ${theme} (median gates; ${rows[0]?.runs ?? 0} runs per URL)`,
    '',
    '| URL | Runs | Min ms | Median ms | Max ms | Spread ms | Runs over limit | Limit ms (level) | Median | Perf. median |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${new URL(r.url).pathname}${new URL(r.url).search} | ${r.runs} | ${r.minMs} | ${r.medianMs} | ${r.maxMs} | ${r.spreadMs} | ${r.runsOverLimit} | ${r.limitMs ?? 'none'} (${r.level}) | ${r.medianPasses ? 'pass' : 'FAIL'} | ${r.performanceMedian} |`,
    ),
    '',
  ];
  return lines.join('\n');
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

function main() {
  // Local runs read the repo .env (CHROME_PATH for the container Chromium), like
  // check-bundle.mjs and playwright.config.ts; shell values win; CI has no .env.
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  // The assertions do not depend on the theme (only the Chrome flags and the report folder do).
  const { assertMatrix } = createRequire(import.meta.url)('../lighthouserc.cjs').ci.assert;
  const sections = [];
  let failed = false;
  for (const theme of ['light', 'dark']) {
    const env = { ...process.env, LHCI_THEME: theme === 'dark' ? 'dark' : '' };
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
  main();
}
