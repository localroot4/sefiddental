import { describe, expect, it } from 'vitest';

import { cpuMultiplierFor, lcpSpread, spreadTable } from './lhci.mjs';

const matrix = [
  {
    matchingUrlPattern: '/qa/not-found',
    assertions: {
      'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
    },
  },
  {
    matchingUrlPattern: '/\\?tier=1',
    assertions: { 'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }] },
  },
];

const lhr = (url: string, lcp: number, performance = 0.98) => ({
  requestedUrl: url,
  audits: { 'largest-contentful-paint': { numericValue: lcp } },
  categories: { performance: { score: performance } },
});

const NOT_FOUND = 'http://localhost:3000/qa/not-found';
const HOME = 'http://localhost:3000/?tier=1';

describe('lcpSpread (scripts/lhci.mjs)', () => {
  it('T-LH1 the median of five runs gates; min, max and spread are reported beside it', () => {
    const runs = [2817, 1824, 2271, 2741, 2276].map((v) => lhr(NOT_FOUND, v));
    expect(lcpSpread(runs, matrix)).toEqual([
      {
        url: NOT_FOUND,
        runs: 5,
        minMs: 1824,
        medianMs: 2276,
        maxMs: 2817,
        spreadMs: 993,
        runsOverLimit: 2,
        limitMs: 2500,
        level: 'error',
        medianPasses: true,
        performanceMedian: 0.98,
      },
    ]);
  });

  it('T-LH2 a median over the limit fails; URLs keep their own assertion level', () => {
    const runs = [
      ...[2600, 2700, 2400, 2800, 2300].map((v) => lhr(NOT_FOUND, v)),
      ...[3000, 3100, 2900].map((v) => lhr(HOME, v, 0.8)),
    ];
    const [notFound, home] = lcpSpread(runs, matrix);
    expect(notFound).toMatchObject({ medianMs: 2600, medianPasses: false, runsOverLimit: 3 });
    expect(home).toMatchObject({ runs: 3, medianMs: 3000, level: 'warn', medianPasses: false });
  });

  it('T-LH3 runs without an LCP value are skipped; the table lists every URL', () => {
    const rows = lcpSpread(
      [lhr(NOT_FOUND, 2000), { ...lhr(NOT_FOUND, 0), audits: {} }, lhr(HOME, 1900)],
      matrix,
    );
    expect(rows.map((r) => r.runs)).toEqual([1, 1]);
    const table = spreadTable('dark', rows);
    expect(table).toContain(
      '| /qa/not-found | 1 | 2000 | 2000 | 2000 | 0 | 0 | 2500 (error) | pass |',
    );
    expect(table).toContain('| /?tier=1 | 1 | 1900 |');
  });
});

describe('cpuMultiplierFor (lighthouse/docs/throttling.md, mid-tier mobile target)', () => {
  it('uses 4x on a high-end desktop host and above it', () => {
    expect(cpuMultiplierFor(1500)).toBe(4);
    expect(cpuMultiplierFor(2300)).toBe(4);
  });
  it('uses 2x on a slower host', () => {
    expect(cpuMultiplierFor(1499)).toBe(2);
    expect(cpuMultiplierFor(900)).toBe(2);
  });
});
