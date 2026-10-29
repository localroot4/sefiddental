import { describe, expect, it } from 'vitest';

import {
  clsFrom,
  frameSummary,
  lighthouseSummary,
  median,
  medianFields,
  parsePace,
  phoneMisses,
  phoneProfileProblem,
  parseSections,
  parseTiers,
  parseViewport,
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

  it('adds the window statistics of `windowStats` to every row, from that section’s deltas only', () => {
    const seen: number[][] = [];
    const rows = sectionStats(
      [
        [16, 'hero'],
        [40, 'services'],
      ],
      [],
      [{ t: 0, id: 'hero' }],
      (deltas: number[]) => {
        seen.push(deltas);
        return { medianFps: 1000 / deltas[0]! };
      },
    );
    expect(seen).toEqual([[16], [40]]);
    expect(rows.map((r) => [r.section, r.medianFps])).toEqual([
      ['hero', 62.5],
      ['services', 25],
    ]);
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

describe('parseTiers', () => {
  it('defaults to 0 and 1, reads --tiers, drops repeats and values outside 0 to 3', () => {
    expect(parseTiers(['docs/qa/x', '--only=frames'])).toEqual([0, 1]);
    // The phone lane's default (phone spec 4.1 item 1).
    expect(parseTiers(['--viewport=phone'], [0, 1, 2])).toEqual([0, 1, 2]);
    expect(parseTiers(['--tiers=1'], [0, 1, 2])).toEqual([1]);
    expect(parseTiers(['docs/qa/x', '--tiers=1,2,2'])).toEqual([1, 2]);
    expect(parseTiers(['--tiers=2,9'])).toEqual([2]);
    expect(() => parseTiers(['--tiers=9'])).toThrow('--tiers');
  });
});

describe('parseSections, parseViewport and parsePace', () => {
  it('--sections is null without the option, a list of unique ids with it, and never empty', () => {
    expect(parseSections(['docs/qa/x', '--tiers=1'])).toBeNull();
    expect(parseSections(['--sections=hero, trust,hero,footer'])).toEqual([
      'hero',
      'trust',
      'footer',
    ]);
    expect(() => parseSections(['--sections=,'])).toThrow('--sections');
  });

  it('--viewport is desktop by default, phone on request, nothing else', () => {
    expect(parseViewport(['docs/qa/x'])).toBe('desktop');
    expect(parseViewport(['--viewport=phone'])).toBe('phone');
    expect(() => parseViewport(['--viewport=tablet'])).toThrow('tablet');
  });

  it('--pace is 80 by default and a whole number of px from 1 to 400 with it', () => {
    expect(parsePace(['docs/qa/x', '--tiers=1'])).toBe(80);
    expect(parsePace(['--pace=16'])).toBe(16);
    expect(() => parsePace(['--pace=0'])).toThrow('--pace');
    expect(() => parsePace(['--pace=1.5'])).toThrow('1.5');
    expect(() => parsePace(['--pace=fast'])).toThrow('fast');
  });
});

describe('phone profile, layout shift and the phone budgets (phone spec 4.1)', () => {
  it('names what keeps a context from the phone profile', () => {
    expect(phoneProfileProblem({ coarse: true, wide: false, lenis: false })).toBeNull();
    expect(phoneProfileProblem({ coarse: false, wide: true, lenis: true })).toBe(
      'the phone profile is not coarse and narrow (the pointer is not coarse, (min-width: 1024px) matches, Lenis runs)',
    );
  });

  it('sums every shift in clsAll and keeps the web-vitals session window in cls', () => {
    const shifts = [
      { t: 0, value: 0.01, hadRecentInput: false },
      { t: 500, value: 0.02, hadRecentInput: false },
      { t: 900, value: 0.5, hadRecentInput: true },
      { t: 3000, value: 0.04, hadRecentInput: false },
    ];
    expect(clsFrom(shifts)).toEqual({ clsAll: 0.57, cls: 0.04 });
    expect(clsFrom([])).toEqual({ clsAll: 0, cls: 0 });
    // One window never spans more than 5 s.
    const steady = Array.from({ length: 12 }, (_, i) => ({
      t: i * 900,
      value: 0.01,
      hadRecentInput: false,
    }));
    expect(clsFrom(steady).cls).toBe(0.06);
  });

  const row = {
    medianFps: 59,
    minWindowFps: 56,
    worstFrameMs: 30,
    longTasksOver100ms: 0,
    framesOver33ms: 1,
    frames: 600,
  };

  it('the T0 gate: tier 0 at 4x needs 58 median and 55 slowest; 6x is recorded only', () => {
    expect(phoneMisses(row, undefined, 0, 4)).toEqual([]);
    expect(phoneMisses({ ...row, medianFps: 57, minWindowFps: 50 }, undefined, 0, 4)).toEqual([
      'median 57 < 58',
      'slowest 50 < 55',
    ]);
    expect(phoneMisses({ ...row, medianFps: 40 }, undefined, 0, 6)).toEqual([]);
  });

  it('P-F: a tier at 4x against tier 0 (at most 1 fps of median, 2 of slowest; frames and tasks)', () => {
    const t0 = { ...row, medianFps: 58, minWindowFps: 54, worstFrameMs: 70 };
    expect(
      phoneMisses({ ...row, medianFps: 57, minWindowFps: 52, worstFrameMs: 70 }, t0, 1, 4),
    ).toEqual([]);
    expect(
      phoneMisses(
        {
          ...row,
          medianFps: 56.5,
          minWindowFps: 51,
          worstFrameMs: 71,
          longTasksOver100ms: 1,
          framesOver33ms: 13,
        },
        t0,
        2,
        4,
      ),
    ).toEqual([
      'median 56.5 < 57',
      'slowest 51 < 52',
      'worst 71 ms > 70',
      '1 long task(s) over 100 ms',
      '13/600 frames over 33 ms',
    ]);
    // A section without a full window is not a fps miss.
    expect(phoneMisses({ ...row, medianFps: 0, minWindowFps: 0 }, t0, 1, 4)).toEqual([]);
  });
});
