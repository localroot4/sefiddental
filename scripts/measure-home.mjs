// Home performance evidence for phase 7 (docs/prompts/07-scroll-experience.md deliverable 7), the
// same script before and after the scroll experience: Lighthouse on /?tier=0 and /?tier=1 (mobile
// and desktop presets, median of 3, over HTTPS and HTTP/2 like scripts/lhci.mjs), frame times per
// home section and long tasks under 4x and 6x CPU throttling, default headless and on a software
// GPU (desktop 1440x900, mouse wheel from top to bottom, median of 3), the JS heap before and
// after that scroll, INP of the hero card submit and of the scene 10 booking block (the booking
// POST is stubbed, as in tests/e2e/home.spec.ts), and initial JS per page class
// (scripts/check-bundle.mjs).
// Writes results.json, bundle.json, bundle.md and README.md into the output folder.
//   node scripts/measure-home.mjs <out dir> [--only=bundle,lighthouse,frames,inp] [--tiers=0,1]
//   (after `npm run build` and `npm run db:e2e`; CHROME_PATH and PW_CHROMIUM_EXECUTABLE set, as
//   in .env; ports E2E_PORT and E2E_PORT + 1 free)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { waitForServer } from './check-bundle.mjs';
import { cpuMultiplierFor, localCertificate, startTlsFront } from './lhci.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let TIERS = [0, 1];
const RATES = [4, 6];
const RUNS = 3;
const BOOKING = '/رزرو-نوبت';
const MiB = 1024 * 1024;
const CONTEXT = { locale: 'fa-IR', timezoneId: 'Asia/Tehran', colorScheme: 'light' };

const round = (value, digits = 0) =>
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

/** Median of the finite values; null when there is none (unknown, never zero). */
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 95th percentile (nearest rank), one decimal; null for no values. */
export function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? round(sorted[Math.ceil(sorted.length * 0.95) - 1], 1) : null;
}

/**
 * Frame and long-task statistics per home section (pure, unit-tested). `frames` holds
 * [delta ms, section id] in order; `changes` the times the section under the viewport's centre
 * line changed; a long task counts for the section that was there when it started.
 */
export function sectionStats(frames, longTasks, changes) {
  const sectionAt = (t) => {
    let id = changes[0]?.id ?? 'none';
    for (const change of changes) {
      if (change.t > t) break;
      id = change.id;
    }
    return id;
  };
  const sections = new Map();
  const entry = (id) => {
    if (!sections.has(id)) sections.set(id, { deltas: [], tasks: [] });
    return sections.get(id);
  };
  for (const [delta, id] of frames) entry(id).deltas.push(delta);
  for (const task of longTasks) entry(sectionAt(task.start)).tasks.push(task.duration);
  return [...sections].map(([section, { deltas, tasks }]) => {
    const total = deltas.reduce((sum, d) => sum + d, 0);
    return {
      section,
      frames: deltas.length,
      meanFps: total > 0 ? round((deltas.length * 1000) / total, 1) : null,
      p95FrameMs: p95(deltas),
      worstFrameMs: deltas.length ? round(Math.max(...deltas), 1) : null,
      framesOver25ms: deltas.filter((d) => d > 25).length,
      framesOver33ms: deltas.filter((d) => d > 33).length,
      longTasks: tasks.length,
      longTasksOver100ms: tasks.filter((d) => d > 100).length,
      longestTaskMs: tasks.length ? round(Math.max(...tasks)) : 0,
    };
  });
}

/** The numbers of one Lighthouse result. */
function lighthouseNumbers(lhr) {
  const a = lhr.audits;
  const script = a['resource-summary']?.details?.items?.find((i) => i.resourceType === 'script');
  const lcpDetails = a['largest-contentful-paint-element']?.details;
  return {
    performance: lhr.categories.performance?.score ?? null,
    lcpMs: a['largest-contentful-paint']?.numericValue,
    cls: a['cumulative-layout-shift']?.numericValue,
    tbtMs: a['total-blocking-time']?.numericValue,
    maxPotentialFidMs: a['max-potential-fid']?.numericValue,
    fcpMs: a['first-contentful-paint']?.numericValue,
    speedIndexMs: a['speed-index']?.numericValue,
    scriptKiB: script ? script.transferSize / 1024 : undefined,
    scriptRequests: script?.requestCount,
    benchmarkIndex: lhr.environment?.benchmarkIndex,
    lcpElement:
      lcpDetails?.items?.[0]?.items?.[0]?.node?.selector ??
      lcpDetails?.items?.[0]?.node?.selector ??
      null,
  };
}

/**
 * One object of the same shape as `objects` holding, per field, the median of the numbers
 * (3 decimals), true only when every run was true, null when no run has it, or the first run's
 * value (pure, unit-tested).
 */
export function medianFields(objects) {
  const out = {};
  for (const key of Object.keys(objects[0] ?? {})) {
    const values = objects.map((o) => o[key]);
    out[key] = values.every((v) => v === null || v === undefined)
      ? null
      : values.some((v) => typeof v === 'number')
        ? round(median(values), 3)
        : typeof values[0] === 'boolean'
          ? values.every(Boolean)
          : values[0];
  }
  return out;
}

/** Per-field medians over the Lighthouse runs, with every run's LCP element; the runs beside. */
export function lighthouseSummary(lhrs) {
  const runs = lhrs.map(lighthouseNumbers);
  const summary = {
    ...medianFields(runs.map(({ lcpElement, ...numbers }) => numbers)),
    runs: runs.length,
    lcpElements: [...new Set(runs.map((r) => r.lcpElement))],
  };
  return { summary, runs };
}

/** Median frame run of a tier and CPU rate: page, heap and each section field by field. */
export function frameSummary(samples) {
  const ids = [...new Set(samples.flatMap((r) => r.sections.map((s) => s.section)))];
  return {
    ...medianFields(samples.map(({ sections, page, heap, ...rest }) => rest)),
    runs: samples.length,
    page: medianFields(samples.map((r) => r.page)),
    heap: medianFields(samples.map((r) => r.heap)),
    sections: ids.map((id) =>
      medianFields(samples.flatMap((r) => r.sections.filter((s) => s.section === id))),
    ),
  };
}

function runLighthouse(url, preset, multiplier, pin) {
  const args = [
    path.join(root, 'node_modules', 'lighthouse', 'cli', 'index.js'),
    url,
    '--only-categories=performance',
    '--output=json',
    '--output-path=stdout',
    '--quiet',
    `--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --ignore-certificate-errors-spki-list=${pin}`,
    preset === 'desktop' ? '--preset=desktop' : `--throttling.cpuSlowdownMultiplier=${multiplier}`,
  ];
  const once = () =>
    execFileSync(process.execPath, args, {
      cwd: root,
      maxBuffer: 256 * MiB,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  let out;
  try {
    out = once();
  } catch {
    // A trace that misses its navigation start (NO_NAVSTART) asks for another run: one retry.
    console.log(`measure-home: lighthouse ${preset} ${url} failed; running it once more`);
    out = once();
  }
  return JSON.parse(out.toString('utf8'));
}

async function measureLighthouse(port) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'measure-tls-'));
  let front;
  try {
    const tls = localCertificate(dir);
    const tlsPort = port + 1;
    front = await startTlsFront(tls, tlsPort, port);
    const origin = `https://localhost:${tlsPort}`;
    // One discarded run warms the server and measures the host, as scripts/lhci.mjs does.
    const warm = runLighthouse(`${origin}/?tier=0`, 'mobile', 4, tls.pin);
    const index = warm.environment?.benchmarkIndex;
    const multiplier = Number(
      process.env.LHCI_CPU_MULTIPLIER ?? (Number.isFinite(index) ? cpuMultiplierFor(index) : 4),
    );
    const rows = [];
    for (const preset of ['mobile', 'desktop']) {
      for (const tier of TIERS) {
        const lhrs = [];
        for (let i = 0; i < RUNS; i += 1) {
          lhrs.push(runLighthouse(`${origin}/?tier=${tier}`, preset, multiplier, tls.pin));
        }
        rows.push({ page: `/?tier=${tier}`, preset, ...lighthouseSummary(lhrs) });
        console.log(`measure-home: lighthouse ${preset} tier ${tier} done`);
      }
    }
    return {
      lighthouseVersion: warm.lighthouseVersion,
      mobileCpuMultiplier: multiplier,
      warmupBenchmarkIndex: round(index),
      rows,
    };
  } finally {
    front?.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Waits for the tier scaffold (engine at load, canvas on idle within 1.5 s); Esc skips an intro. */
async function settle(page) {
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function heapMiB(page) {
  const cdp = await page.context().newCDPSession(page);
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach();
  return round(usedSize / MiB, 1);
}

/**
 * In-page sampler: requestAnimationFrame deltas tagged with the section under the viewport's
 * centre line (an IntersectionObserver, so no layout read per frame and no scroll listener; the
 * innermost section wins, e.g. the trust band inside the hero) and long tasks with start times.
 */
function startSampler() {
  const w = window;
  const sections = [...document.querySelectorAll('[data-home-section]')];
  const active = new Set();
  let current = 'none';
  const changes = [{ t: performance.now(), id: current }];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) active.add(e.target);
        else active.delete(e.target);
      }
      const list = [...active];
      const inner = list.find((el) => !list.some((other) => other !== el && el.contains(other)));
      const id = inner ? inner.getAttribute('data-home-section') : 'none';
      if (id !== current) {
        current = id;
        changes.push({ t: performance.now(), id });
      }
    },
    { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
  );
  for (const section of sections) io.observe(section);
  const frames = [];
  const longTasks = [];
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longTasks.push({ start: e.startTime, duration: e.duration });
  });
  po.observe({ type: 'longtask' });
  const started = performance.now();
  let last = -1;
  let running = true;
  const tick = (now) => {
    if (last >= 0) frames.push([now - last, current]);
    last = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  w.__measureHome = {
    stop: () => {
      running = false;
      io.disconnect();
      po.disconnect();
      return {
        frames,
        longTasks,
        changes,
        durationMs: performance.now() - started,
        scrollHeight: document.documentElement.scrollHeight,
        sections: sections.map((s) => s.getAttribute('data-home-section')),
      };
    },
  };
}

async function scrollThrough(page) {
  await page.evaluate(startSampler);
  const deadline = Date.now() + 180_000;
  let reachedBottom = false;
  while (!reachedBottom && Date.now() < deadline) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(50);
    reachedBottom = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
    );
  }
  await page.waitForTimeout(500);
  const raw = await page.evaluate(() => window.__measureHome.stop());
  return { ...raw, reachedBottom };
}

/** Closes a context without hiding the error that got us here when the browser is already gone. */
const closeQuietly = (context) => context.close().catch(() => {});

async function measureFrames(browser, origin, h, tier, rate) {
  const context = await (await browser()).newContext({ ...h.VIEWPORTS.desktop, ...CONTEXT });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/?tier=${tier}`, { waitUntil: 'load' });
    await settle(page);
    await page.mouse.move(720, 450);
    await h.collectGarbage(page);
    const heapBeforeMiB = await heapMiB(page);
    const restore = await h.throttleCpu(page, rate);
    const raw = await scrollThrough(page);
    await restore();
    const heapAfterMiB = await heapMiB(page);
    await h.collectGarbage(page);
    const heapAfterGcMiB = await heapMiB(page);
    const tasks = raw.longTasks.map((t) => t.duration);
    return {
      tier,
      rate,
      reachedBottom: raw.reachedBottom,
      scrollMs: round(raw.durationMs),
      scrollHeight: raw.scrollHeight,
      sectionsInDom: raw.sections,
      page: {
        ...h.frameStatsFrom(
          raw.frames.map(([d]) => d),
          tasks.filter((d) => d > 100).length,
        ),
        p95FrameMs: p95(raw.frames.map(([d]) => d)),
        longTasks: tasks.length,
        longestTaskMs: tasks.length ? round(Math.max(...tasks)) : 0,
      },
      sections: sectionStats(raw.frames, raw.longTasks, raw.changes),
      heap: { beforeMiB: heapBeforeMiB, afterMiB: heapAfterMiB, afterGcMiB: heapAfterGcMiB },
    };
  } finally {
    await closeQuietly(context);
  }
}

/** Event Timing entries of real interactions (16 ms is the API's lowest reporting threshold). */
function observeEventTiming() {
  const w = window;
  w.__eventTiming = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue;
      w.__eventTiming.push({
        name: e.name,
        start: e.startTime,
        duration: e.duration,
        processingStart: e.processingStart,
        processingEnd: e.processingEnd,
      });
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
}

async function measureInp(browser, origin, h, viewport, tier, form) {
  const context = await (await browser()).newContext({ ...h.VIEWPORTS[viewport], ...CONTEXT });
  const page = await context.newPage();
  try {
    // The `{ ok: true }` answer of tests/e2e/home.spec.ts: the success state, no stored booking.
    await page.route(
      (url) => decodeURI(url.pathname) === BOOKING,
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 200, json: { ok: true } })
          : route.continue(),
    );
    await page.addInitScript(observeEventTiming);
    await page.goto(`${origin}/?tier=${tier}`, { waitUntil: 'load' });
    // Hydrated (tests/helpers/booking.ts formsHydrated): a click before it is the no-JS post.
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-booking-form] form')].every((f) => f.noValidate),
    );
    await settle(page);
    const selector = form === 'hero' ? '#bk-hero' : '#bk-block';
    const card = page.locator(selector);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const press = (locator) => (viewport === 'phone' ? locator.tap() : locator.click());
    const restore = await h.throttleCpu(page, 4);
    const typingFrom = await page.evaluate(() => performance.now());
    const phone = card.locator('input[name="phone"]');
    await press(phone);
    await phone.pressSequentially('09123456789', { delay: 60 });
    const submitFrom = await page.evaluate(() => performance.now());
    await press(card.locator('button[type="submit"]'));
    const success = await page
      .waitForFunction((s) => document.querySelector(s)?.dataset.state === 'success', selector, {
        timeout: 15_000,
      })
      .then(
        () => true,
        () => false,
      );
    await page.waitForTimeout(1000);
    await restore();
    const entries = await page.evaluate(() => window.__eventTiming);
    const worst = (list) => list.reduce((w, e) => (w && w.duration >= e.duration ? w : e), null);
    const submit = worst(entries.filter((e) => e.start >= submitFrom));
    const typing = worst(entries.filter((e) => e.start >= typingFrom && e.start < submitFrom));
    return {
      success,
      submitMs: submit?.duration ?? null,
      submitEvent: submit && {
        name: submit.name,
        inputDelayMs: round(submit.processingStart - submit.start),
        processingMs: round(submit.processingEnd - submit.processingStart),
        presentationMs: round(submit.start + submit.duration - submit.processingEnd),
      },
      typingWorstMs: typing?.duration ?? null,
    };
  } finally {
    await closeQuietly(context);
  }
}

/**
 * One measurement run, and once more after a failure: Chromium has died mid-run here (the
 * browser process went away during an INP run at tier 1), and a second run on a fresh browser
 * is the whole cure. A second failure is a real problem, so it propagates.
 */
export async function retried(label, run) {
  try {
    return await run();
  } catch (error) {
    console.log(
      `measure-home: ${label} failed (${String(error).split('\n')[0]}); running it once more`,
    );
    return run();
  }
}

function measureBundle(outDir) {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-bundle.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  const budgets = path.join(root, 'test-results', 'budgets');
  copyFileSync(path.join(budgets, 'initial-js.json'), path.join(outDir, 'bundle.json'));
  copyFileSync(path.join(budgets, 'initial-js.md'), path.join(outDir, 'bundle.md'));
  return { exitCode: run.status };
}

const ms = (v) => (v === null || v === undefined ? 'unknown' : String(round(v)));
// Event Timing reports nothing under 16 ms: a missing entry reads as "< 16", never as 0.
const inpMs = (v) => (v === null || v < 16 ? '< 16' : String(round(v)));

function readme(results, bundleMd) {
  const { host } = results;
  const lines = [
    `# Home performance (${results.label})`,
    '',
    `Measured ${results.measuredAt} on commit ${host.commit}${host.dirty ? ' with local changes' : ''}; ${host.chromium}; host ${host.cpus} CPUs, load average ${host.loadAverage.join(' / ')} at the start.`,
    '',
    'Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):',
    '',
    '```',
    results.command,
    '```',
    '',
  ];
  if (results.lighthouse) {
    const lh = results.lighthouse;
    lines.push(
      `## Lighthouse (median of ${RUNS})`,
      '',
      `Lighthouse ${lh.lighthouseVersion}, performance category only, over HTTPS and HTTP/2 (scripts/tls-front.mjs), simulated throttling. Mobile preset CPU slowdown ${lh.mobileCpuMultiplier}x (host benchmarkIndex ${lh.warmupBenchmarkIndex}; scripts/lhci.mjs rule); desktop preset 1x. Lighthouse has no INP in a navigation: TBT and max potential FID are its proxies. Total JS is every script of the load, transfer size.`,
      '',
      '| Page | Preset | Score | LCP ms | CLS | TBT ms | Max potential FID ms | FCP ms | Total JS KiB (requests) | LCP element |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...lh.rows.map(
        ({ page, preset, summary: s }) =>
          `| \`${page}\` | ${preset} | ${round(s.performance, 2)} | ${ms(s.lcpMs)} | ${round(s.cls, 3)} | ${ms(s.tbtMs)} | ${ms(s.maxPotentialFidMs)} | ${ms(s.fcpMs)} | ${ms(s.scriptKiB)} (${s.scriptRequests}) | ${s.lcpElements.map((e) => `\`${e}\``).join(', ')} |`,
      ),
      '',
    );
  }
  if (results.frames) {
    const runs = results.frames;
    lines.push(
      `## Frame times and heap (desktop 1440x900, median of ${RUNS} runs field by field)`,
      '',
      'Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.',
      '',
      '| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...runs.map(
        (r) =>
          `| ${r.gpu} | ${r.tier} | ${r.rate}x | ${round(r.page.medianFps, 1)} | ${round(r.page.minWindowFps, 1)} | ${round(r.page.p95FrameMs, 1)} | ${round(r.page.worstFrameMs, 1)} | ${round(r.page.framesOver33ms)} | ${round(r.page.longTasks)} (${round(r.page.longTasksOver100ms)}) | ${round(r.page.longestTaskMs)} | ${round(r.heap.beforeMiB, 1)} / ${round(r.heap.afterMiB, 1)} / ${round(r.heap.afterGcMiB, 1)} | ${round(r.scrollMs / 1000, 1)} | ${r.reachedBottom ? 'yes' : 'no'} |`,
      ),
      '',
    );
    const order = [...new Set(runs.flatMap((r) => r.sections.map((s) => s.section)))];
    lines.push(
      '### Per section (mean fps / p95 frame ms / long tasks, longest ms)',
      '',
      'The section is the innermost `data-home-section` under the viewport centre line; `none` is the header strip at the top, gaps and the footer.',
      '',
      `| Section | ${runs.map((r) => `${r.gpu}, tier ${r.tier}, ${r.rate}x`).join(' | ')} |`,
      `|---|${runs.map(() => '---').join('|')}|`,
      ...order.map((id) => {
        const cells = runs.map((r) => {
          const s = r.sections.find((x) => x.section === id);
          return s
            ? `${round(s.meanFps, 1)} / ${round(s.p95FrameMs, 1)} / ${round(s.longTasks)}${s.longTasks ? `, ${round(s.longestTaskMs)}` : ''}`
            : '-';
        });
        return `| ${id} | ${cells.join(' | ')} |`;
      }),
      '',
    );
  }
  if (results.inp) {
    lines.push(
      `## INP of the booking submits (CPU 4x, median of ${RUNS})`,
      '',
      'Default headless Chromium. Event Timing API (PerformanceObserver, durationThreshold 16 ms, the lowest it allows: "< 16" means no entry). Typing is a tap or click on the phone field and 11 key presses 60 ms apart; the submit is a click (desktop) or a tap (phone). The booking POST is answered `{ ok: true }` without the real handler. Breakdown: the slowest run.',
      '',
      '| Viewport | Tier | Form | Submit ms (runs) | Slowest submit: event, input delay / processing / presentation ms | Worst typing ms | Success state |',
      '|---|---|---|---|---|---|---|',
      ...results.inp.map((row) => {
        const values = row.runs.map((r) => r.submitMs);
        const slowest = row.runs.reduce((w, r) => ((r.submitMs ?? 0) > (w.submitMs ?? 0) ? r : w));
        const e = slowest.submitEvent;
        return `| ${row.viewport} | ${row.tier} | ${row.form} | ${inpMs(median(values.map((v) => v ?? 0)))} (${values.map(inpMs).join(', ')}) | ${e ? `${e.name}, ${e.inputDelayMs} / ${e.processingMs} / ${e.presentationMs}` : '-'} | ${inpMs(median(row.runs.map((r) => r.typingWorstMs ?? 0)))} | ${row.runs.filter((r) => r.success).length}/${row.runs.length} |`;
      }),
      '',
    );
  }
  if (results.bundle) {
    lines.push(
      `## Initial JS per page class (scripts/check-bundle.mjs, exit code ${results.bundle.exitCode})`,
      '',
      'Encoded (gzip) bytes of every script that started before the load event, desktop 1440x900, light theme. Full data: bundle.json.',
      '',
      bundleMd.trim(),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

/** `--tiers=1,2` picks the tiers Lighthouse, frames and INP run at (default 0 and 1). */
export function parseTiers(args) {
  const arg = args.find((a) => a.startsWith('--tiers='));
  if (!arg) return [0, 1];
  const tiers = [...new Set(arg.slice('--tiers='.length).split(',').map(Number))].filter(
    (t) => Number.isInteger(t) && t >= 0 && t <= 3,
  );
  if (!tiers.length)
    throw new Error('measure-home: --tiers needs numbers 0 to 3, e.g. --tiers=1,2');
  return tiers;
}

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => !a.startsWith('--'));
  if (!outArg) {
    console.error('measure-home: name the output folder, e.g. docs/qa/phase-07/baseline.');
    process.exit(2);
  }
  const only = new Set(
    (
      args.find((a) => a.startsWith('--only='))?.slice('--only='.length) ??
      'bundle,lighthouse,frames,inp'
    ).split(','),
  );
  TIERS = parseTiers(args);
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const outDir = path.resolve(root, outArg);
  mkdirSync(outDir, { recursive: true });
  const port = Number(process.env.E2E_PORT ?? '3000');
  const origin = `http://localhost:${port}`;
  const git = (...a) => execFileSync('git', a, { cwd: root }).toString().trim();
  const results = {
    label: path.relative(path.join(root, 'docs', 'qa'), outDir),
    measuredAt: new Date().toISOString(),
    command: `E2E_PORT=${port} node scripts/measure-home.mjs ${path.relative(root, outDir)}${args.some((a) => a.startsWith('--only=')) ? ` --only=${[...only].join(',')}` : ''}${args.some((a) => a.startsWith('--tiers=')) ? ` --tiers=${TIERS.join(',')}` : ''}`,
    host: {
      commit: git('rev-parse', '--short', 'HEAD'),
      dirty: git('status', '--porcelain').length > 0,
      cpus: os.cpus().length,
      loadAverage: os.loadavg().map((v) => round(v, 2)),
      chromium: null,
    },
  };

  let bundleMd = '';
  // check-bundle starts and stops its own server on E2E_PORT: run it before ours.
  if (only.has('bundle')) {
    results.bundle = measureBundle(outDir);
    bundleMd = readFileSync(path.join(outDir, 'bundle.md'), 'utf8');
  }

  const server = spawn(process.execPath, [path.join(root, 'scripts', 'start-standalone.mjs')], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
      SITE_URL: origin,
      QA_ROUTES: '1',
      ALLOW_INDEXING: 'true',
      DB_PUSH: 'false',
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'file:./.data/e2e.db',
      // Every page load fetches /api/form-session from one localhost client (playwright.config.ts).
      FORM_SESSION_RATE_LIMIT: '100000',
    },
  });
  // Written after every lane, so a crash in a later lane keeps the earlier numbers.
  const save = () => {
    writeFileSync(path.join(outDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    writeFileSync(path.join(outDir, 'README.md'), readme(results, bundleMd));
  };
  let browser;
  let launchOptions;
  // The browser of the current lane, launched again if the previous one died.
  const getBrowser = async () => {
    if (!browser?.isConnected()) {
      const { chromium } = await import('@playwright/test');
      browser = await chromium.launch(launchOptions);
      results.host.chromium = `Chromium ${browser.version()}`;
    }
    return browser;
  };
  const closeBrowser = async () => {
    await browser?.close().catch(() => {});
    browser = undefined;
  };
  try {
    await waitForServer(origin, server, 60_000);
    if (only.has('lighthouse')) {
      results.lighthouse = await measureLighthouse(port);
      save();
    }
    if (only.has('frames') || only.has('inp')) {
      const ts = (file) => import(pathToFileURL(path.join(root, 'tests', 'helpers', file)).href);
      const h = {
        ...(await ts('cpu.ts')),
        ...(await ts('frames.ts')),
        ...(await ts('screens.ts')),
      };
      const { defaultLaunch, swiftShaderLaunch } = await ts('launch.ts');
      if (only.has('frames')) {
        results.frames = [];
        // The software GPU the master prompt asks for, and the default headless path: on
        // SwiftShader the GPU side can hide what CPU throttling does to the main thread.
        for (const gpu of ['default', 'swiftshader']) {
          launchOptions = gpu === 'swiftshader' ? swiftShaderLaunch() : defaultLaunch();
          for (const tier of TIERS) {
            for (const rate of RATES) {
              const label = `frames ${gpu} tier ${tier} ${rate}x`;
              const samples = [];
              for (let i = 0; i < RUNS; i += 1) {
                samples.push(
                  await retried(label, () => measureFrames(getBrowser, origin, h, tier, rate)),
                );
              }
              results.frames.push({ gpu, ...frameSummary(samples), samples });
              console.log(`measure-home: ${label} done`);
            }
          }
          await closeBrowser();
        }
        save();
      }
      if (only.has('inp')) {
        // Default launch: SwiftShader alone put about 180 ms of presentation delay on a submit at
        // 1x CPU, which would drown the main-thread cost INP is about.
        launchOptions = defaultLaunch();
        results.inp = [];
        for (const viewport of ['desktop', 'phone']) {
          for (const tier of TIERS) {
            for (const form of ['hero', 'block']) {
              const label = `inp ${viewport} tier ${tier} ${form}`;
              const runs = [];
              for (let i = 0; i < RUNS; i += 1) {
                runs.push(
                  await retried(label, () =>
                    measureInp(getBrowser, origin, h, viewport, tier, form),
                  ),
                );
              }
              results.inp.push({ viewport, tier, form, runs });
              console.log(`measure-home: ${label} done`);
            }
          }
        }
        save();
      }
    }
  } finally {
    await closeBrowser();
    server.kill('SIGTERM');
  }
  save();
  console.log(`measure-home: wrote ${path.relative(root, outDir)}/results.json and README.md`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`measure-home: ${error.stack ?? error.message}`);
    process.exit(1);
  });
}
