import { describe, expect, it } from 'vitest';

import { createMonitorSampler, SAMPLER_DEFAULTS } from './monitorSampler';

/** Pushes `count` frames of `deltaMs` each, starting after `startMs`; returns the end time. */
function feed(
  sampler: ReturnType<typeof createMonitorSampler>,
  startMs: number,
  deltaMs: number,
  count: number,
): number {
  let now = startMs;
  for (let i = 0; i < count; i += 1) {
    now += deltaMs;
    sampler.push(deltaMs / 1000, now);
  }
  return now;
}

describe('createMonitorSampler', () => {
  it('V4 drops every sample inside the 1000 ms warm-up', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s.fps));
    sampler.reset(0);
    feed(sampler, 0, 20, 49); // 980 ms, all inside the warm-up
    expect(windows).toEqual([]);
  });

  it('V4 reports one fps sample per 250 ms window after the warm-up', () => {
    const windows: { nowMs: number; fps: number }[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s));
    sampler.reset(0);
    // 20 ms frames (50 fps): warm-up until 1000 ms, then 13 frames (260 ms) per window.
    feed(sampler, 0, 20, 102);
    expect(windows).toHaveLength(4);
    for (const w of windows) expect(w.fps).toBeCloseTo(50, 5);
    expect(windows.map((w) => w.nowMs)).toEqual([1240, 1500, 1760, 2020]);
  });

  it('V4 a pause above 10 s resets the window and restarts the warm-up', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s.fps));
    sampler.reset(0);
    let now = feed(sampler, 0, 16, 70); // 1120 ms: warm-up over, half a window counted
    now += 12_000;
    sampler.push(12, now); // pause: reset at 13120, warm-up until 14120
    now = feed(sampler, now, 16, 60); // ends at 14080, still warming up
    expect(windows).toEqual([]);
    feed(sampler, now, 16, 20);
    expect(windows).toHaveLength(1);
  });

  it('V4 slow real frames count: 500 ms frames report 2 fps', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s.fps));
    sampler.reset(0);
    feed(sampler, 0, 500, 6); // 500 ms frames until 3000 ms; counted from 1000 ms
    expect(windows).toEqual([2, 2, 2, 2, 2]);
  });

  it('V4 a 2.2 s frame (software GPU under stress, measured) still counts', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s.fps));
    sampler.reset(0);
    feed(sampler, 0, 2200, 2);
    expect(windows.map((fps) => fps.toFixed(3))).toEqual(['0.455', '0.455']);
  });

  it('V4 the first push arms the warm-up when nobody called reset', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler(SAMPLER_DEFAULTS, (s) => windows.push(s.fps));
    sampler.push(5.3, 5300); // R3F's first delta under frameloop="never" is the clock time
    feed(sampler, 5300, 16, 62); // 992 ms: inside the warm-up
    expect(windows).toEqual([]);
  });

  it('V4 negative or NaN deltas reset instead of counting', () => {
    const windows: number[] = [];
    const sampler = createMonitorSampler({ windowMs: 250, warmupMs: 0, maxDeltaMs: 250 }, (s) =>
      windows.push(s.fps),
    );
    sampler.reset(0);
    sampler.push(-0.01, 10);
    sampler.push(Number.NaN, 20);
    feed(sampler, 20, 25, 10);
    expect(windows).toEqual([40]);
  });
});
