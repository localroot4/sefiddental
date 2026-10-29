// Per-scene frame times and heap on home (phase 7 report D19; lane QA): at ?tier=1 and ?tier=2,
// 4x and 6x CPU throttling, a full scroll down and back up at 1440x900 on the default GPU
// (project perf-default) and on SwiftShader (perf-swiftshader), plus the phone rows of the phone
// spec (4.2, T-PS-P0 to T-PS-P4: 390x844 touch, its section 4 budgets against tier 0). The wheel
// steps 40 px every 50 ms, half the measure-home pace, so that a section one
// viewport tall holds a full 1 s window on each pass (at 80 px the hero, whose top half is
// never scrolled through, held none on a quiet host). Every run records its numbers:
// annotations, a JSON attachment and one console line per section. The budgets of the report's
// section 5 (per section at 4x: median 1 s window at least 59 fps, slowest window at least 55,
// worst frame at most 50 ms, no long task over 100 ms; tier 1 at 6x: page median at least 50;
// heap after GC within +0.5 MiB of the start) are asserted only with PERF_GATE=1 on
// perf-default: CI runs every project on a 2-core runner without a GPU, where the baseline is
// 44.5 fps at tier 0 on SwiftShader, so the numbers are valid only on the measurement host,
// where the integrator runs `PERF_GATE=1 npx playwright test --project=perf-default`. On CI the
// perf-default project is skipped: without a GPU it would repeat perf-swiftshader's runs.
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { t } from '@/i18n/fa';

import {
  engineCreation,
  heapMiB,
  observeShiftsAndTasks,
  phoneMisses,
  phoneProfileProblem,
  settle,
  startSampler,
} from '../../scripts/measure-home.mjs';
import { collectGarbage, throttleCpu, type CpuRate } from '../helpers/cpu';
import {
  frameStatsFrom,
  scrollThrough,
  sectionFrameStats,
  type FrameStats,
  type ScrollDrive,
  type SectionFrameStats,
} from '../helpers/frames';
import { skipIntro } from '../helpers/intro';
import { VIEWPORTS } from '../helpers/screens';

const BUDGET = {
  medianFps: 59,
  minWindowFps: 55,
  worstFrameMs: 50,
  tier1MedianFpsAt6x: 50,
  heapMiB: 0.5,
} as const;

const STEP_PX = 40;
/** One scroll pass: two of them with the settle and the GC readings fit the 300 s test timeout. */
const SCROLL_DEADLINE_MS = 120_000;

/** What `startSampler`'s `stop()` returns in the page. */
interface Raw {
  frames: Array<[number, string]>;
  longTasks: Array<{ start: number; duration: number }>;
  changes: Array<{ t: number; id: string }>;
  heights: Record<string, number>;
}

interface Run {
  reachedBottom: boolean;
  reachedTop: boolean;
  page: FrameStats & { longTasks: number; longestTaskMs: number };
  sections: SectionFrameStats[];
  /** Scroll height per section id (a pin spacer's when pinned) and of the viewport. */
  heights: Record<string, number>;
  viewportHeight: number;
  /** CDP heap readings in MiB; null is a failed reading (unknown, never zero). */
  heap: { beforeMiB: number | null; afterMiB: number | null; afterGcMiB: number | null };
}

const gated = (testInfo: TestInfo): boolean =>
  process.env.PERF_GATE === '1' && testInfo.project.name === 'perf-default';

const fps = (v: number): string => (v ? v.toFixed(1) : '-');

test.beforeEach(({ page }, testInfo) => {
  test.skip(
    Boolean(process.env.CI) && testInfo.project.name === 'perf-default',
    'recorded on perf-swiftshader on CI; perf-default is the measurement host project (D19)',
  );
  return skipIntro(page);
});

async function sampleRun(
  page: Page,
  rate: CpuRate,
  drive: ScrollDrive,
  upToo = true,
): Promise<Run> {
  await settle(page);
  if (drive === 'wheel') await page.mouse.move(720, 450);
  await collectGarbage(page);
  const beforeMiB = await heapMiB(page);
  const restore = await throttleCpu(page, rate);
  await page.evaluate(startSampler);
  const scroll = { drive, stepPx: STEP_PX, deadlineMs: SCROLL_DEADLINE_MS };
  const reachedBottom = await scrollThrough(page, 1, scroll);
  const reachedTop = upToo ? await scrollThrough(page, -1, scroll) : true;
  await page.waitForTimeout(500);
  const raw = await page.evaluate(() =>
    (window as unknown as { __measureHome: { stop(): Raw } }).__measureHome.stop(),
  );
  await restore();
  const afterMiB = await heapMiB(page);
  await collectGarbage(page);
  const afterGcMiB = await heapMiB(page);
  const tasks = raw.longTasks.map((t) => t.duration);
  return {
    reachedBottom,
    reachedTop,
    page: {
      ...frameStatsFrom(
        raw.frames.map(([delta]) => delta),
        tasks.filter((d) => d > 100).length,
      ),
      longTasks: tasks.length,
      longestTaskMs: tasks.length ? Math.max(...tasks) : 0,
    },
    sections: sectionFrameStats(raw.frames, raw.longTasks, raw.changes),
    heights: raw.heights,
    viewportHeight: page.viewportSize()?.height ?? 0,
    heap: { beforeMiB, afterMiB, afterGcMiB },
  };
}

async function record(testInfo: TestInfo, label: string, run: Run): Promise<void> {
  const summary = `page median ${fps(run.page.medianFps)} fps (slowest window ${fps(run.page.minWindowFps)}), worst frame ${run.page.worstFrameMs.toFixed(1)} ms, long tasks ${run.page.longTasks} (${run.page.longTasksOver100ms} over 100 ms), heap MiB ${run.heap.beforeMiB} / ${run.heap.afterMiB} / ${run.heap.afterGcMiB}`;
  testInfo.annotations.push({ type: `frames ${label}`, description: summary });
  await testInfo.attach(`frames-${label}.json`, {
    body: JSON.stringify(run, null, 2),
    contentType: 'application/json',
  });
  const rows = run.sections.map(
    (s) =>
      `  ${s.section}: median ${fps(s.medianFps)} / slowest ${fps(s.minWindowFps)} fps, worst ${s.worstFrameMs.toFixed(1)} ms, p95 ${s.p95FrameMs ?? '-'} ms, long tasks ${s.longTasks} (${s.longTasksOver100ms} over 100 ms)`,
  );
  console.log(`${testInfo.project.name} ${label}: ${summary}\n${rows.join('\n')}`);
}

/** Soft expectations: one run lists every miss at once. */
function assertBudgets(run: Run, tier: number, rate: CpuRate): void {
  if (rate === 4) {
    for (const s of run.sections) {
      // A section without one full 1 s window has no window numbers: expected of a gap or the
      // top strip (`none`) and of a short section, a miss for one at least a viewport tall.
      if (s.section !== 'none' && (run.heights[s.section] ?? 0) >= run.viewportHeight) {
        expect.soft(s.medianFps > 0, `${s.section} holds one full 1 s window`).toBe(true);
      }
      if (s.medianFps > 0) {
        expect
          .soft(s.medianFps, `${s.section} median window fps at 4x`)
          .toBeGreaterThanOrEqual(BUDGET.medianFps);
        expect
          .soft(s.minWindowFps, `${s.section} slowest window fps at 4x`)
          .toBeGreaterThanOrEqual(BUDGET.minWindowFps);
      }
      expect
        .soft(s.worstFrameMs, `${s.section} worst frame ms at 4x`)
        .toBeLessThanOrEqual(BUDGET.worstFrameMs);
      expect.soft(s.longTasksOver100ms, `${s.section} long tasks over 100 ms at 4x`).toBe(0);
    }
  } else if (tier === 1) {
    expect
      .soft(run.page.medianFps, 'tier 1 page median fps at 6x')
      .toBeGreaterThanOrEqual(BUDGET.tier1MedianFpsAt6x);
  }
  const { beforeMiB, afterGcMiB } = run.heap;
  expect.soft(beforeMiB !== null && afterGcMiB !== null, 'both heap readings known').toBe(true);
  if (beforeMiB !== null && afterGcMiB !== null) {
    expect
      .soft(afterGcMiB - beforeMiB, 'heap MiB after the scroll and a GC, over the start')
      .toBeLessThanOrEqual(BUDGET.heapMiB);
  }
}

for (const tier of [1, 2]) {
  for (const rate of [4, 6] as const) {
    test(`T-PS tier ${tier} at ${rate}x: frames per section and heap over a full down-and-up scroll at 1440x900`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);
      await page.goto(`/?tier=${tier}`, { waitUntil: 'load' });
      const run = await sampleRun(page, rate, 'wheel');
      await record(testInfo, `tier${tier}-${rate}x`, run);
      expect(run.reachedBottom && run.reachedTop, 'scrolled to the bottom and back').toBe(true);
      expect(run.page.frames).toBeGreaterThan(0);
      if (gated(testInfo)) assertBudgets(run, tier, rate);
    });
  }
}

// Phone rows (phone spec 4.2). Every one runs in the phone profile, checks it first (4.1 item 2)
// and swipes by touch (CDP touch events, no fling); recorded always, asserted with PERF_GATE=1 on
// perf-default.

async function phonePage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...VIEWPORTS.phone,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await skipIntro(page);
  return { context, page };
}

async function expectPhoneProfile(page: Page): Promise<void> {
  const problem = phoneProfileProblem(
    await page.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      wide: matchMedia('(min-width: 1024px)').matches,
      lenis: document.documentElement.classList.contains('lenis'),
    })),
  );
  expect(problem).toBeNull();
}

/** Tier 0 per section at 4x in this worker (T-PS-P0), the reference of T-PS-P1. */
let t0Sections: SectionFrameStats[] | null = null;

async function phoneSections(browser: Browser, tier: number, rate: CpuRate): Promise<Run> {
  const { context, page } = await phonePage(browser);
  try {
    await page.goto(`/?tier=${tier}`, { waitUntil: 'load' });
    await expectPhoneProfile(page);
    const run = await sampleRun(page, rate, 'touch', false);
    expect(run.reachedBottom, 'swiped to the bottom').toBe(true);
    return run;
  } finally {
    await context.close();
  }
}

function assertPhone(run: Run, t0: SectionFrameStats[] | null, tier: number): void {
  for (const s of run.sections) {
    if (s.section === 'none') continue;
    const reference = t0?.find((x) => x.section === s.section);
    expect.soft(phoneMisses(s, reference, tier, 4), `${s.section} at tier ${tier}, 4x`).toEqual([]);
  }
}

test('T-PS-P0 phone ?tier=0 at 4x: the T0 gate per section (median window at least 58 fps, slowest at least 55)', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const run = await phoneSections(browser, 0, 4);
  t0Sections = run.sections;
  await record(testInfo, 'phone-tier0-4x', run);
  if (gated(testInfo)) assertPhone(run, null, 0);
});

for (const tier of [1, 2]) {
  test(`T-PS-P1 phone ?tier=${tier} at 4x: the frames row per section against tier 0 (T-PS-P0)`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    t0Sections ??= (await phoneSections(browser, 0, 4)).sections;
    const run = await phoneSections(browser, tier, 4);
    await record(testInfo, `phone-tier${tier}-4x`, run);
    const deltas = run.sections.map((s) => {
      const t0 = t0Sections?.find((x) => x.section === s.section);
      return `${s.section} ${s.medianFps && t0?.medianFps ? (s.medianFps - t0.medianFps).toFixed(1) : '-'}`;
    });
    testInfo.annotations.push({ type: 'median fps vs tier 0', description: deltas.join(', ') });
    if (gated(testInfo)) assertPhone(run, t0Sections, tier);
  });
}

test('T-PS-P2 phone ?tier=1 at 6x: recorded (target page median at least 50)', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const run = await phoneSections(browser, 1, 6);
  await record(testInfo, 'phone-tier1-6x', run);
  expect(run.page.frames).toBeGreaterThan(0);
});

type Hook = {
  snapshot(): {
    tier: number;
    layout: { latchedAtTier: number };
    tickSubscribers: number;
    monitor: { frames: number };
    labels: string[];
  };
};
const snap = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sefid: Hook }).__sefid.snapshot());

/** `?debug=1` loads no canvas on a phone (D5), so the DOM frame monitor runs as for a visitor. */
async function monitorPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const opened = await phonePage(browser);
  await opened.page.addInitScript(observeShiftsAndTasks);
  await opened.page.goto('/?tier=1&monitor=1&debug=1', { waitUntil: 'load' });
  await opened.page.waitForFunction(
    () => {
      const hook = (window as unknown as { __sefid?: Hook }).__sefid;
      return hook !== undefined && hook.snapshot().labels.length > 0;
    },
    null,
    { timeout: 20_000 },
  );
  await expectPhoneProfile(opened.page);
  return opened;
}

test('T-PS-P3 the frame monitor on the phone profile: no step-down at 4x over a full scroll, 0 tick subscribers 1 s after it, one step to tier 0 within 10 s of swiping a page slowed to about 25 fps', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  // False positive at 4x, then the idle ticker.
  const quiet = await monitorPage(browser);
  try {
    const restore = await throttleCpu(quiet.page, 4);
    const reached = await scrollThrough(quiet.page, 1, { drive: 'touch' });
    await restore();
    await quiet.page.waitForTimeout(1000);
    const after = await snap(quiet.page);
    // The monitor's own frame loop sleeps at rest too: no frame in a further second.
    await quiet.page.waitForTimeout(1000);
    const restFrames = (await snap(quiet.page)).monitor.frames - after.monitor.frames;
    const quietNote = `tier ${after.tier} after a full scroll, ${after.tickSubscribers} tick subscribers 1 s after it, ${after.monitor.frames} monitor frames and ${restFrames} in the next second`;
    testInfo.annotations.push({ type: 'monitor 4x', description: quietNote });
    console.log(`${testInfo.project.name} T-PS-P3 4x: ${quietNote}`);
    expect(reached).toBe(true);
    expect(after.tickSubscribers, 'the ticker sleeps at rest').toBe(0);
    expect.soft(after.monitor.frames, 'the monitor ran while the page scrolled').toBeGreaterThan(0);
    expect.soft(restFrames, 'the monitor frame loop sleeps at rest').toBe(0);
    if (gated(testInfo)) expect.soft(after.tier, 'no step-down at 4x').toBe(1);
  } finally {
    await quiet.context.close();
  }

  // True positive: the phone profile with 40 ms of main-thread work in every frame (about 25 fps),
  // swiped until the tier drops (at most 10 s of swiping). CPU throttling alone does not slow
  // this page's swipes: at 20x and 40x the frames in which the page moves hold 60 fps once the
  // creation work is done (step 4b measurement), so the work goes into the frames directly.
  const slow = await monitorPage(browser);
  try {
    const restore = await throttleCpu(slow.page, 4);
    await slow.page.evaluate(() => {
      const busy = (): void => {
        const end = performance.now() + 40;
        while (performance.now() < end) {
          // A slow phone's frame.
        }
        requestAnimationFrame(busy);
      };
      requestAnimationFrame(busy);
    });
    const started = Date.now();
    let stepped = false;
    while (!stepped && Date.now() - started < 10_000) {
      await scrollThrough(slow.page, 1, {
        drive: 'touch',
        endY: (await slow.page.evaluate(() => window.scrollY)) + 400,
        deadlineMs: 3000,
      });
      stepped = (await snap(slow.page)).tier === 0;
    }
    const lastSwipe = Date.now();
    const relatchedEarly = (await snap(slow.page)).layout.latchedAtTier === 0;
    // Recorded either way; asserted below only on the measurement host.
    const relatched = await expect
      .poll(async () => (await snap(slow.page)).layout.latchedAtTier, { timeout: 5000 })
      .toBe(0)
      .then(
        () => true,
        () => false,
      );
    const relatchMs = relatched ? Date.now() - lastSwipe : null;
    await restore();
    const cls = await slow.page.evaluate(() =>
      (window as unknown as { __shifts: Array<{ value: number }> }).__shifts.reduce(
        (sum, shift) => sum + shift.value,
        0,
      ),
    );
    const notice = await slow.page.locator('#light-notice-text').textContent();
    const slowNote = `stepped ${stepped} after ${lastSwipe - started} ms of swiping; relatched ${relatchMs} ms after the last swipe (early: ${relatchedEarly}); clsAll ${cls.toFixed(4)}; notice "${notice}"`;
    testInfo.annotations.push({ type: 'monitor slow page', description: slowNote });
    console.log(`${testInfo.project.name} T-PS-P3 slow page: ${slowNote}`);
    if (gated(testInfo)) {
      expect.soft(stepped, 'one step to tier 0 within 10 s of swiping').toBe(true);
      expect.soft(relatchedEarly, 'no relatch before 1000 ms without scroll').toBe(false);
      expect.soft(notice, 'the stepped notice opened').toBe(t('home.light.stepped'));
    }
  } finally {
    await slow.context.close();
  }
});

test('T-PS-P4 phone ?tier=1 at 4x from the navigation: engine creation (initMs target 50 ms) with no task over 50 ms', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const { context, page } = await phonePage(browser);
  try {
    await page.addInitScript(observeShiftsAndTasks);
    const restore = await throttleCpu(page, 4);
    await page.goto('/?tier=1', { waitUntil: 'load' });
    await expectPhoneProfile(page);
    await page.waitForFunction(
      () => performance.getEntriesByName('sefid:engine-init').length > 0,
      null,
      {
        timeout: 30_000,
      },
    );
    await page.waitForTimeout(1500);
    const creation = await page.evaluate(engineCreation);
    await restore();
    testInfo.annotations.push({
      type: 'engine creation 4x',
      description: `initMs ${creation.initMs?.toFixed(1)}, longest task ${creation.longestTaskMs?.toFixed(0)} ms`,
    });
    console.log(`${testInfo.project.name} T-PS-P4: ${JSON.stringify(creation)}`);
    expect(creation.initMs).not.toBeNull();
    if (gated(testInfo)) {
      expect.soft(creation.longestTaskMs ?? 0, 'no task over 50 ms').toBeLessThanOrEqual(50);
    }
  } finally {
    await context.close();
  }
});
