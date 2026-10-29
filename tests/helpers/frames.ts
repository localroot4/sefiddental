// Frame-time sampler, same method as the phase 2 prototypes so numbers compare: a
// requestAnimationFrame loop records frame deltas after a warm-up, a PerformanceObserver counts
// long tasks, and the page is scrolled without adding any scroll listener.
import type { Page } from '@playwright/test';

import { sectionStats } from '../../scripts/measure-home.mjs';

export interface FrameStats {
  /** Median frames per second over consecutive 1 s windows. */
  medianFps: number;
  /** Frames per second of the slowest 1 s window. */
  minWindowFps: number;
  worstFrameMs: number;
  framesOver33ms: number;
  longTasksOver100ms: number;
  frames: number;
}

export interface SampleOptions {
  warmupMs?: number;
  durationMs?: number;
  /** wheel: mouse wheel steps (desktop, smooth scroll); scroll: window.scrollBy (phones). */
  drive?: 'wheel' | 'scroll' | 'none';
}

// A window closes at 1 s minus half a millisecond, so float sums of exact frame times
// (60 x 16.666… ms) close on the frame that completes the second.
const WINDOW_MS = 1000 - 0.5;

/** Pure statistics over frame deltas in milliseconds (exported for unit tests). */
export function frameStatsFrom(deltas: readonly number[], longTasksOver100ms: number): FrameStats {
  const windows: number[] = [];
  let frames = 0;
  let elapsed = 0;
  for (const delta of deltas) {
    frames += 1;
    elapsed += delta;
    if (elapsed >= WINDOW_MS) {
      windows.push((frames * 1000) / elapsed);
      frames = 0;
      elapsed = 0;
    }
  }
  const sorted = [...windows].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? (sorted[mid] ?? 0)
        : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return {
    medianFps: median,
    minWindowFps: sorted[0] ?? 0,
    worstFrameMs: deltas.length === 0 ? 0 : Math.max(...deltas),
    framesOver33ms: deltas.filter((d) => d > 33).length,
    longTasksOver100ms,
    frames: deltas.length,
  };
}

export async function sampleFrames(page: Page, options: SampleOptions = {}): Promise<FrameStats> {
  const warmupMs = options.warmupMs ?? 2500;
  const durationMs = options.durationMs ?? 5000;
  const drive = options.drive ?? 'none';

  const sampling = page.evaluate(
    ({ warmup, duration }) =>
      new Promise<{ deltas: number[]; longTasks: number }>((resolve) => {
        const deltas: number[] = [];
        let longTasks = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (entry.duration > 100) longTasks += 1;
        });
        try {
          observer.observe({ type: 'longtask', buffered: false });
        } catch {
          // No Long Tasks API in this browser: the count stays 0.
        }
        const start = performance.now();
        let last = start;
        const tick = (now: number) => {
          if (now - start >= warmup) deltas.push(now - last);
          last = now;
          if (now - start < warmup + duration) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            resolve({ deltas, longTasks });
          }
        };
        requestAnimationFrame(tick);
      }),
    { warmup: warmupMs, duration: durationMs },
  );

  if (drive !== 'none') {
    const end = Date.now() + warmupMs + durationMs;
    let direction = 1;
    while (Date.now() < end) {
      if (drive === 'wheel') await page.mouse.wheel(0, 120 * direction);
      else await page.evaluate((dy) => window.scrollBy(0, dy), 60 * direction);
      await page.waitForTimeout(50);
      const atEdge = await page.evaluate(
        (down) =>
          down
            ? window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
            : window.scrollY <= 0,
        direction > 0,
      );
      if (atEdge) direction = -direction;
    }
  }

  const { deltas, longTasks } = await sampling;
  return frameStatsFrom(deltas, longTasks);
}

/** One row per home section: the measure-home fields plus the 1 s window numbers. */
export interface SectionFrameStats extends FrameStats {
  section: string;
  meanFps: number | null;
  p95FrameMs: number | null;
  framesOver25ms: number;
  longTasks: number;
  longestTaskMs: number;
}

/**
 * Per-section statistics of a sampler run (scripts/measure-home.mjs `startSampler`), with the
 * section attribution of `sectionStats` and the window statistics of `frameStatsFrom`: the
 * budgets name a median and a slowest 1 s window per scene.
 */
export function sectionFrameStats(
  frames: Array<[number, string]>,
  longTasks: Array<{ start: number; duration: number }>,
  changes: Array<{ t: number; id: string }>,
): SectionFrameStats[] {
  return sectionStats(frames, longTasks, changes, (deltas: number[]) => {
    const { medianFps, minWindowFps } = frameStatsFrom(deltas, 0);
    return { medianFps, minWindowFps };
  });
}

export type ScrollDrive = 'wheel' | 'touch';

export interface ScrollOptions {
  /** wheel (desktop, the measure-home method) or touch swipes (phones). */
  drive?: ScrollDrive;
  /** Page y to stop at; the bottom going down and the top going up without it. */
  endY?: number;
  /** Wheel step in px every 50 ms (default 80); smaller is slower, so short sections hold 1 s. */
  stepPx?: number;
  /**
   * Touch: finger travel in px per 50 ms (measure-home `--pace`; 80 moves a 500 px swipe in about
   * 310 ms). Without it a swipe is 10 moves 16 ms apart.
   */
  fingerPx?: number;
  /** Touch: lift without the 100 ms hold, so the page may fling; `onFling` gets the px it went. */
  fling?: boolean;
  onFling?: (px: number) => void;
  /** Gives up after this long (default 3 minutes); the result says so. */
  deadlineMs?: number;
}

/**
 * Scrolls from where the page is to `endY` (default: the bottom going down, the top going up).
 * `wheel` turns the mouse wheel `stepPx` every 50 ms; `touch` swipes one finger 500 px per
 * gesture through CDP touch events (`Input.dispatchTouchEvent`, as Playwright's own tap does;
 * `Input.synthesizeScrollGesture` moved nothing in headless Chromium), moves 16 ms apart
 * (`fingerPx` per 50 ms sets their length), with a 100 ms hold before the finger lifts so no
 * fling follows and every swipe moves the same distance (`fling` lifts at once instead). A swipe that
 * starts on a part with `touch-action: none` (the playground's Draggables) drags the part, not
 * the page: when the page did not move, the next swipe starts 120 px further along its own path
 * (shortened where the path would leave the viewport) until one moves it. Resolves with whether
 * the end was reached inside `deadlineMs`.
 */
export async function scrollThrough(
  page: Page,
  direction: 1 | -1,
  options: ScrollOptions = {},
): Promise<boolean> {
  const { drive = 'wheel', endY, stepPx = 80, deadlineMs = 180_000, fingerPx, fling } = options;
  const cdp = drive === 'touch' ? await page.context().newCDPSession(page) : null;
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  // The finger starts at 80% of the height going down (20% going up).
  const home = Math.round(direction > 0 ? size.height * 0.8 : size.height * 0.2);
  let from = home;
  let lastY = -1;
  const deadline = Date.now() + deadlineMs;
  let done = false;
  while (!done && Date.now() < deadline) {
    if (cdp) {
      const x = Math.round(size.width / 2);
      const to = Math.min(size.height - 8, Math.max(8, from - direction * 500));
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
        });
      // `fingerPx` per 50 ms is `fingerPx * 16 / 50` per 16 ms move.
      const moves = fingerPx ? Math.max(1, Math.ceil(Math.abs(to - from) / (fingerPx * 0.32))) : 10;
      await touch('touchStart', from);
      for (let step = 1; step <= moves; step += 1) {
        await touch('touchMove', Math.round(from + ((to - from) * step) / moves));
        await page.waitForTimeout(16);
      }
      if (!fling) await page.waitForTimeout(100);
      const liftY = fling ? await page.evaluate(() => window.scrollY) : 0;
      await touch('touchEnd', 0);
      if (fling) {
        await page.waitForTimeout(600);
        options.onFling?.(Math.abs((await page.evaluate(() => window.scrollY)) - liftY));
      }
    } else {
      await page.mouse.wheel(0, stepPx * direction);
    }
    await page.waitForTimeout(50);
    const state = await page.evaluate(
      ([down, end]) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        return {
          y,
          done: down ? y >= Math.min(end ?? max, max) - 2 : y <= (end ?? 0),
        };
      },
      [direction > 0, endY ?? null] as const,
    );
    done = state.done;
    if (cdp) {
      from = state.y === lastY ? from - direction * 120 : home;
      if (from < 8 || from > size.height - 8) from = home;
    }
    lastY = state.y;
  }
  await cdp?.detach();
  return done;
}
