import { describe, expect, it } from 'vitest';

import type { Tier } from '@/lib/qualityTier';

import { createFrameMonitor, type MonitorWindow } from './frameMonitor';

/** Renders frames of `deltaMs` from `startMs` to `endMs`. */
function run(
  monitor: ReturnType<typeof createFrameMonitor>,
  startMs: number,
  endMs: number,
  deltaMs: number,
) {
  for (let now = startMs + deltaMs; now <= endMs; now += deltaMs) monitor.push(deltaMs / 1000, now);
}

describe('createFrameMonitor', () => {
  it('M1 a steady 50 fps drops one tier after warm-up plus 2 s of slow time', () => {
    const steps: { tier: Tier; at: number }[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'auto',
      onStepDown: (tier, at) => steps.push({ tier, at }),
    });
    monitor.reset(0);
    // 13 frames of 20 ms close a window every 260 ms: 1240, 1500, ... 3060.
    run(monitor, 0, 3000, 20);
    expect(steps).toEqual([]);
    run(monitor, 3000, 3100, 20);
    // Slow time adds up window by window: the eighth window (2080 ms) ends at 3060 ms.
    expect(steps).toEqual([{ tier: 2, at: 3060 }]);
  });

  it('M2 drop path: 10 fps walks 3 -> 2 -> 1 -> 0 and then stops', () => {
    const steps: Tier[] = [];
    const monitor = createFrameMonitor({ tier: 3, mode: 'auto', onStepDown: (t) => steps.push(t) });
    monitor.reset(0);
    run(monitor, 0, 20_000, 100);
    expect(steps).toEqual([2, 1, 0]);
    expect(monitor.state().tier).toBe(0);
  });

  it('M2b after a drop the next one waits for a fresh warm-up plus the 2 s hold', () => {
    const steps: number[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'auto',
      onStepDown: (_tier, at) => steps.push(at),
    });
    monitor.reset(0);
    run(monitor, 0, 8000, 20); // a steady 50 fps
    expect(steps).toHaveLength(2);
    expect(steps[0]).toBe(3060);
    expect((steps[1] ?? 0) - (steps[0] ?? 0)).toBeGreaterThanOrEqual(3000);
  });

  it('M3 fixed mode never steps, whatever the frame rate', () => {
    const steps: Tier[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'fixed',
      onStepDown: (t) => steps.push(t),
    });
    monitor.reset(0);
    run(monitor, 0, 10_000, 200);
    expect(steps).toEqual([]);
    expect(monitor.state().tier).toBe(3);
  });

  it('M4 a good frame rate never steps down or up', () => {
    const steps: Tier[] = [];
    const monitor = createFrameMonitor({ tier: 2, mode: 'auto', onStepDown: (t) => steps.push(t) });
    monitor.reset(0);
    run(monitor, 0, 10_000, 16);
    expect(steps).toEqual([]);
    expect(monitor.state().tier).toBe(2);
  });

  it('M5 a good window inside the hold time restarts it', () => {
    const steps: Tier[] = [];
    const monitor = createFrameMonitor({ tier: 3, mode: 'auto', onStepDown: (t) => steps.push(t) });
    monitor.reset(0);
    run(monitor, 0, 2500, 20); // below 55 fps from 1240 ms
    run(monitor, 2500, 2800, 8); // 125 fps: resets the hold
    run(monitor, 2800, 4600, 20); // under 2 s below again
    expect(steps).toEqual([]);
    run(monitor, 4600, 5200, 20);
    expect(steps).toEqual([2]);
  });

  it('M6 phone mode: 1 s of slow time goes to tier 0 in one step; each window is reported', () => {
    const steps: { tier: Tier; at: number }[] = [];
    const windows: MonitorWindow[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'auto',
      phone: true,
      onStepDown: (tier, at) => steps.push({ tier, at }),
      onWindow: (w) => windows.push(w),
    });
    monitor.reset(0);
    run(monitor, 0, 2100, 20);
    // Four windows of 260 ms (1040 ms of slow time) end at 2020 ms.
    expect(steps).toEqual([{ tier: 0, at: 2020 }]);
    expect(windows).toEqual([
      { slowMs: 260, slow: true, stepped: false },
      { slowMs: 520, slow: true, stepped: false },
      { slowMs: 780, slow: true, stepped: false },
      { slowMs: 0, slow: true, stepped: true },
    ]);
  });

  it('M7 cut drops the partial window (a scroll that ended) and keeps the warm-up', () => {
    const windows: MonitorWindow[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'auto',
      onStepDown: () => {},
      onWindow: (w) => windows.push(w),
    });
    monitor.reset(0);
    run(monitor, 0, 1200, 20); // 220 ms of good frames after the warm-up: no window yet
    monitor.cut();
    run(monitor, 5000, 5300, 100); // three 100 ms frames, counted at once: no new warm-up
    expect(windows).toEqual([{ slowMs: 300, slow: true, stepped: false }]);
  });
});
