// Per-scene frame times and heap on home (phase 7 report D19; lane QA): at ?tier=1 and ?tier=2,
// 4x and 6x CPU throttling, a full scroll down and back up at 1440x900 on the default GPU
// (project perf-default) and on SwiftShader (perf-swiftshader), plus one 390x844 touch run at
// 6x. The wheel steps 40 px every 50 ms, half the measure-home pace, so that a section one
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
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { heapMiB, settle, startSampler } from '../../scripts/measure-home.mjs';
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

async function sampleRun(page: Page, rate: CpuRate, drive: ScrollDrive): Promise<Run> {
  await settle(page);
  if (drive === 'wheel') await page.mouse.move(720, 450);
  await collectGarbage(page);
  const beforeMiB = await heapMiB(page);
  const restore = await throttleCpu(page, rate);
  await page.evaluate(startSampler);
  const scroll = { drive, stepPx: STEP_PX, deadlineMs: SCROLL_DEADLINE_MS };
  const reachedBottom = await scrollThrough(page, 1, scroll);
  const reachedTop = await scrollThrough(page, -1, scroll);
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

test('T-PS phone 390x844 touch at ?tier=1 and 6x: recorded, never gated', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    ...VIEWPORTS.phone,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await skipIntro(page);
  try {
    await page.goto('/?tier=1', { waitUntil: 'load' });
    const run = await sampleRun(page, 6, 'touch');
    await record(testInfo, 'phone-tier1-6x', run);
    expect(run.reachedBottom && run.reachedTop, 'scrolled to the bottom and back').toBe(true);
    expect(run.page.frames).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
