import { describe, expect, it } from 'vitest';

import {
  frameSummary,
  lighthouseSummary,
  median,
  medianFields,
  retried,
  sectionStats,
} from './measure-home.mjs';

describe('retried', () => {
  it('runs once more after one failure and gives up after two', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 2) throw new Error('browser gone');
      return 'ok';
    };
    await expect(retried('x', flaky)).resolves.toBe('ok');
    expect(calls).toBe(2);
    await expect(retried('x', () => Promise.reject(new Error('still gone')))).rejects.toThrow(
      'still gone',
    );
  });
});

describe('median', () => {
  it('ignores values that are not finite and is null for none', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([undefined, 5, Number.NaN])).toBe(5);
    expect(median([undefined])).toBeNull();
  });
});

describe('sectionStats', () => {
  it('splits frames by section and gives each long task to the section where it started', () => {
    const frames: Array<[number, string]> = [
      [16, 'hero'],
      [17, 'hero'],
      [50, 'services'],
      [16, 'services'],
    ];
    const changes = [
      { t: 0, id: 'none' },
      { t: 10, id: 'hero' },
      { t: 100, id: 'services' },
    ];
    const longTasks = [
      { start: 50, duration: 60 },
      { start: 150, duration: 120 },
      { start: 160, duration: 70 },
    ];
    const [hero, services] = sectionStats(frames, longTasks, changes);
    expect(hero).toMatchObject({ section: 'hero', frames: 2, framesOver33ms: 0, longTasks: 1 });
    expect(hero?.meanFps).toBeCloseTo(60.6, 1);
    expect(services).toMatchObject({
      section: 'services',
      frames: 2,
      p95FrameMs: 50,
      worstFrameMs: 50,
      framesOver25ms: 1,
      framesOver33ms: 1,
      longTasks: 2,
      longTasksOver100ms: 1,
      longestTaskMs: 120,
    });
  });
});

describe('medianFields', () => {
  it('takes medians of numbers, all of booleans and the first of anything else', () => {
    expect(
      medianFields([
        { fps: 30, ok: true, id: 'a' },
        { fps: 60, ok: false, id: 'b' },
        { fps: 50, ok: true, id: 'c' },
      ]),
    ).toEqual({ fps: 50, ok: false, id: 'a' });
  });

  it('keeps a section seen in only some runs (frameSummary)', () => {
    const run = (fps: number, sections: Array<{ section: string; meanFps: number }>) => ({
      tier: 1,
      rate: 4,
      reachedBottom: true,
      page: { medianFps: fps },
      heap: { beforeMiB: 3 },
      sections,
    });
    const summary = frameSummary([
      run(40, [{ section: 'hero', meanFps: 40 }]),
      run(50, [
        { section: 'hero', meanFps: 50 },
        { section: 'faq', meanFps: 20 },
      ]),
      run(60, [{ section: 'hero', meanFps: 60 }]),
    ]);
    expect(summary).toMatchObject({ tier: 1, rate: 4, runs: 3, page: { medianFps: 50 } });
    expect(summary.sections).toEqual([
      { section: 'hero', meanFps: 50 },
      { section: 'faq', meanFps: 20 },
    ]);
  });
});

describe('lighthouseSummary', () => {
  const lhr = (lcp: number, selector: string) => ({
    categories: { performance: { score: 0.9 } },
    environment: { benchmarkIndex: 2000 },
    audits: {
      'largest-contentful-paint': { numericValue: lcp },
      'cumulative-layout-shift': { numericValue: 0.01 },
      'resource-summary': {
        details: { items: [{ resourceType: 'script', transferSize: 2048, requestCount: 7 }] },
      },
      'largest-contentful-paint-element': {
        details: { items: [{ items: [{ node: { selector } }] }] },
      },
    },
  });

  it('gives per-metric medians and every LCP element; a missing audit stays unknown', () => {
    const { summary, runs } = lighthouseSummary([
      lhr(1800, 'img.hero'),
      lhr(2400, 'img.hero'),
      lhr(2000, 'h1'),
    ]);
    expect(runs).toHaveLength(3);
    expect(summary).toMatchObject({
      runs: 3,
      lcpMs: 2000,
      cls: 0.01,
      scriptKiB: 2,
      scriptRequests: 7,
      tbtMs: null,
      lcpElements: ['img.hero', 'h1'],
    });
  });
});
