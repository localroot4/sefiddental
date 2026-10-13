import { describe, expect, it } from 'vitest';

import { frameStatsFrom } from './frames';

describe('frameStatsFrom', () => {
  it('T-FR1 steady 60 fps gives 60 in every 1 s window', () => {
    const stats = frameStatsFrom(Array<number>(180).fill(1000 / 60), 0);
    expect(stats.medianFps).toBeCloseTo(60, 5);
    expect(stats.minWindowFps).toBeCloseTo(60, 5);
    expect(stats.framesOver33ms).toBe(0);
    expect(stats.frames).toBe(180);
  });

  it('T-FR2 one slow second sets the minimum window, not the median', () => {
    const fast = Array<number>(60).fill(1000 / 60);
    const slow = Array<number>(30).fill(1000 / 30);
    const stats = frameStatsFrom([...fast, ...slow, ...fast], 2);
    expect(stats.medianFps).toBeCloseTo(60, 5);
    expect(stats.minWindowFps).toBeCloseTo(30, 5);
    expect(stats.longTasksOver100ms).toBe(2);
  });

  it('T-FR3 frames over 33 ms and the worst frame are counted', () => {
    const stats = frameStatsFrom([16, 40, 16, 120, 33], 0);
    expect(stats.framesOver33ms).toBe(2);
    expect(stats.worstFrameMs).toBe(120);
  });

  it('T-FR4 no frames gives zeros, never NaN', () => {
    expect(frameStatsFrom([], 0)).toEqual({
      medianFps: 0,
      minWindowFps: 0,
      worstFrameMs: 0,
      framesOver33ms: 0,
      longTasksOver100ms: 0,
      frames: 0,
    });
  });
});
