// Bundle-size check per page class (deliverable 8; freeze decision 4; spec-experience-tooling
// 4.9). Starts the standalone server on the migrated e2e database, loads every page of
// tests/budgets/limits.json in Chromium, and fails when a class exceeds its interim limit. The
// documented targets (docs/brief.md section 7) are printed beside every measurement.
//
// Initial JS = encoded (gzip) bytes of every script that started before the load event ended.
// Shared JS = scripts on every measured page; route JS = initial minus shared.
//   node scripts/check-bundle.mjs        (after `npm run build` and `npm run db:e2e`)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KiB = 1024;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const kib = (bytes) => Math.round((bytes / KiB) * 10) / 10;

/**
 * Pure verdicts over the measurements (unit-tested).
 * @param {Record<string, { pages: { url: string, scripts: Record<string, number>, cssBytes: number, fontBytes: number, foreignOrigins: string[], webglBeforeLoad: boolean, webglAfterLoad: boolean, gsapBeforeLoad?: boolean, gsapAfterLoad?: boolean }[] }>} measured
 * @param {any} limits tests/budgets/limits.json
 */
export function evaluate(measured, limits) {
  const allPages = Object.values(measured).flatMap((c) => c.pages);
  const scriptSets = allPages.map((p) => new Set(Object.keys(p.scripts)));
  const shared = scriptSets.length
    ? [...scriptSets[0]].filter((url) => scriptSets.every((set) => set.has(url)))
    : [];
  const rows = [];
  const failures = [];
  for (const [name, spec] of Object.entries(limits.classes)) {
    const pages = measured[name]?.pages ?? [];
    if (pages.length === 0) {
      rows.push({ pageClass: name, url: null, note: spec.pendingNote ?? 'no pages listed' });
      continue;
    }
    for (const page of pages) {
      const sizes = Object.entries(page.scripts);
      const initial = sizes.reduce((sum, [, bytes]) => sum + bytes, 0);
      const sharedBytes = sizes
        .filter(([url]) => shared.includes(url))
        .reduce((sum, [, b]) => sum + b, 0);
      const row = {
        pageClass: name,
        url: page.url,
        initialKiB: kib(initial),
        sharedKiB: kib(sharedBytes),
        routeKiB: kib(initial - sharedBytes),
        interimKiB: spec.interimKiB,
        routeAllowanceKiB: spec.routeAllowanceKiB,
        targetKB: spec.targetKB,
        cssKiB: kib(page.cssBytes),
        fontKiB: kib(page.fontBytes),
      };
      rows.push(row);
      const at = `${name} ${page.url}`;
      if (initial > spec.interimKiB * KiB) {
        failures.push(`B1 ${at}: initial JS ${row.initialKiB} KiB > ${spec.interimKiB} KiB`);
      }
      if (initial - sharedBytes > spec.routeAllowanceKiB * KiB) {
        failures.push(
          `B2 ${at}: route JS ${row.routeKiB} KiB > allowance ${spec.routeAllowanceKiB} KiB`,
        );
      }
      if (name === 'home' ? page.webglBeforeLoad : page.webglBeforeLoad || page.webglAfterLoad) {
        failures.push(
          `B3 ${at}: three.js (WebGLRenderer) loaded ${name === 'home' ? 'before load' : 'on a content page'}`,
        );
      }
      // Phase 7: the scroll engine is a chunk after `load` on home and nothing elsewhere; a
      // static gsap import would add about 50 KiB before `load` and could hide under the limit.
      if (name === 'home' ? page.gsapBeforeLoad : page.gsapBeforeLoad || page.gsapAfterLoad) {
        failures.push(
          `B3 ${at}: gsap (_gsap or ScrollTrigger) loaded ${name === 'home' ? 'before load' : 'on a content page'}`,
        );
      }
      if (page.cssBytes > limits.cssKiB * KiB) {
        failures.push(`B4 ${at}: CSS ${row.cssKiB} KiB > ${limits.cssKiB} KiB`);
      }
      if (page.fontBytes > limits.fontsKiB * KiB) {
        failures.push(`B4 ${at}: fonts ${row.fontKiB} KiB > ${limits.fontsKiB} KiB`);
      }
      for (const origin of page.foreignOrigins) {
        failures.push(`B5 ${at}: request to another origin ${origin}`);
      }
    }
  }
  return { rows, failures, sharedScripts: shared };
}

/** Markdown table for the phase report (B6). */
export function markdownTable(rows) {
  const lines = [
    '| Class | Page | Initial JS | Shared | Route | Interim limit | Route allowance | Doc target | CSS | Fonts |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    lines.push(
      r.url === null
        ? `| ${r.pageClass} | none (${r.note}) | | | | | | | | |`
        : `| ${r.pageClass} | \`${r.url}\` | ${r.initialKiB} KiB | ${r.sharedKiB} KiB | ${r.routeKiB} KiB | ${r.interimKiB} KiB | ${r.routeAllowanceKiB} KiB | ${r.targetKB} KB | ${r.cssKiB} KiB | ${r.fontKiB} KiB |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function waitForServer(origin, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      await fetch(origin, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`server did not answer within ${timeoutMs} ms`);
}

async function measurePage(browser, origin, url) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    locale: 'fa-IR',
  });
  const page = await context.newPage();
  const foreign = new Set();
  const scriptBodies = [];
  page.on('request', (request) => {
    const requestOrigin = new URL(request.url()).origin;
    if (requestOrigin !== origin && !request.url().startsWith('data:')) foreign.add(requestOrigin);
  });
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      const at = Date.now();
      scriptBodies.push(
        response.text().then(
          (text) => ({
            at,
            webgl: text.includes('WebGLRenderer'),
            gsap: text.includes('_gsap') || text.includes('ScrollTrigger'),
          }),
          () => ({ at, webgl: false, gsap: false }),
        ),
      );
    }
  });
  const response = await page.goto(origin + url, { waitUntil: 'load' });
  if (response?.status() !== 200) {
    throw new Error(`${url} answered ${response?.status()}: every listed page must return 200.`);
  }
  // The load time on the page's own clock (wall time, like the responses' Date.now() in Node):
  // a chunk requested at `load` is received after loadEventStart, while Node's clock after
  // goto resolves can run behind the response events of a loaded host.
  const loadedAt = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return performance.timeOrigin + (nav ? nav.loadEventStart : performance.now());
  });
  // Content pages must not fetch three.js later either (B3): watch 3 s after load.
  await page.waitForTimeout(3000);
  const entries = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const loadEnd = nav ? nav.loadEventEnd : performance.now();
    return performance.getEntriesByType('resource').map((e) => ({
      name: e.name,
      type: e.initiatorType,
      beforeLoad: e.startTime < loadEnd,
      encoded: e.encodedBodySize,
      transfer: e.transferSize,
    }));
  });
  const bodies = await Promise.all(scriptBodies);
  await context.close();

  const scripts = {};
  let cssBytes = 0;
  let fontBytes = 0;
  for (const e of entries) {
    const p = new URL(e.name).pathname;
    if (p.endsWith('.js') && e.beforeLoad) scripts[p] = (scripts[p] ?? 0) + e.encoded;
    if (p.endsWith('.css')) cssBytes += e.encoded;
    if (p.endsWith('.woff2')) fontBytes += e.transfer;
  }
  return {
    url,
    scripts,
    cssBytes,
    fontBytes,
    foreignOrigins: [...foreign],
    webglBeforeLoad: bodies.some((b) => b.webgl && b.at <= loadedAt),
    webglAfterLoad: bodies.some((b) => b.webgl && b.at > loadedAt),
    gsapBeforeLoad: bodies.some((b) => b.gsap && b.at <= loadedAt),
    gsapAfterLoad: bodies.some((b) => b.gsap && b.at > loadedAt),
  };
}

async function main() {
  // Same as playwright.config.ts: the repo .env names the container Chromium
  // (PW_CHROMIUM_EXECUTABLE) locally; shell values win; CI has no .env.
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const limits = JSON.parse(readFileSync(path.join(root, 'tests/budgets/limits.json'), 'utf8'));
  const port = Number(process.env.E2E_PORT ?? '3000');
  const origin = `http://localhost:${port}`;
  const { chromium } = await import('@playwright/test');
  const { defaultLaunch } = await import(
    pathToFileURL(path.join(root, 'tests/helpers/launch.ts')).href
  );

  const server = spawn(process.execPath, [path.join(root, 'scripts/start-standalone.mjs')], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
      SITE_URL: origin,
      QA_ROUTES: '1',
      DB_PUSH: 'false',
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'file:./.data/e2e.db',
    },
  });
  let browser;
  try {
    await waitForServer(origin, server, 60_000);
    browser = await chromium.launch(defaultLaunch());
    const measured = {};
    for (const [name, spec] of Object.entries(limits.classes)) {
      measured[name] = { pages: [] };
      for (const url of spec.pages)
        measured[name].pages.push(await measurePage(browser, origin, url));
    }
    const result = evaluate(measured, limits);
    const table = markdownTable(result.rows);
    const outDir = path.join(root, 'test-results', 'budgets');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, 'initial-js.json'),
      `${JSON.stringify({ ...result, measured }, null, 2)}\n`,
    );
    writeFileSync(path.join(outDir, 'initial-js.md'), table);
    console.log(table);
    if (result.failures.length > 0) {
      for (const failure of result.failures) console.error(`FAILED ${failure}`);
      process.exitCode = 1;
    } else {
      console.log('check-bundle: every page class is inside its interim limits.');
    }
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`check-bundle: ${error.message}`);
    process.exit(1);
  });
}
