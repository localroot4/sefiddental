import { describe, expect, it } from 'vitest';

import { frameStatsFrom, sectionFrameStats } from './frames';

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

describe('sectionFrameStats', () => {
  it('T-FR5 each section gets its own 1 s windows beside the measure-home fields', () => {
    const frames: Array<[number, string]> = [
      ...Array<[number, string]>(120).fill([1000 / 60, 'hero']),
      ...Array<[number, string]>(60).fill([1000 / 30, 'services']),
      [16, 'none'],
    ];
    const [hero, services, none] = sectionFrameStats(
      frames,
      [{ start: 2500, duration: 120 }],
      [
        { t: 0, id: 'hero' },
        { t: 2000, id: 'services' },
      ],
    );
    expect(hero).toMatchObject({ section: 'hero', frames: 120, longTasks: 0 });
    expect(hero?.medianFps).toBeCloseTo(60, 5);
    expect(hero?.minWindowFps).toBeCloseTo(60, 5);
    expect(services).toMatchObject({
      section: 'services',
      frames: 60,
      longTasks: 1,
      longTasksOver100ms: 1,
      longestTaskMs: 120,
    });
    expect(services?.medianFps).toBeCloseTo(30, 5);
    expect(services?.minWindowFps).toBeCloseTo(30, 5);
    // One frame holds no full window: the window numbers are 0, the frame count is still there.
    expect(none).toMatchObject({ section: 'none', frames: 1, medianFps: 0, minWindowFps: 0 });
  });
});
