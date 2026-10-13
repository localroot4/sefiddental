// Frame-time sampler, same method as the phase 2 prototypes so numbers compare: a
// requestAnimationFrame loop records frame deltas after a warm-up, a PerformanceObserver counts
// long tasks, and the page is scrolled without adding any scroll listener.
import type { Page } from '@playwright/test';

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
