import { describe, expect, it } from 'vitest';

import type { Tier } from '@/lib/qualityTier';

import { createFrameMonitor } from './frameMonitor';

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
  it('M1 a steady 50 fps drops one tier after warm-up plus 2 s under 55 fps', () => {
    const steps: { tier: Tier; at: number }[] = [];
    const monitor = createFrameMonitor({
      tier: 3,
      mode: 'auto',
      onStepDown: (tier, at) => steps.push({ tier, at }),
    });
    monitor.reset(0);
    // 13 frames of 20 ms close a window every 260 ms: 1240, 1500, ... (below since 1240 ms).
    run(monitor, 0, 3300, 20);
    expect(steps).toEqual([]);
    run(monitor, 3300, 3400, 20);
    // The first window at least 2000 ms after 1240 ms ends at 3320 ms.
    expect(steps).toEqual([{ tier: 2, at: 3320 }]);
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
    expect(steps[0]).toBe(3320);
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
});
