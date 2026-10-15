import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { cpuMultiplierFor, lcpSpread, spreadTable } from './lhci.mjs';

const matrix = [
  {
    matchingUrlPattern: '/qa/not-found',
    assertions: {
      'largest-contentful-paint': [
        'error',
        { maxNumericValue: 2500, aggregationMethod: 'optimistic' },
      ],
      'total-blocking-time': ['error', { maxNumericValue: 400, aggregationMethod: 'median' }],
    },
  },
  {
    matchingUrlPattern: '/\\?tier=1',
    assertions: { 'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }] },
  },
];

const lhr = (url: string, lcp: number, performance = 0.98, tbt = 150) => ({
  requestedUrl: url,
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'total-blocking-time': { numericValue: tbt },
  },
  categories: { performance: { score: performance } },
});

const NOT_FOUND = 'http://localhost:3000/qa/not-found';
const HOME = 'http://localhost:3000/?tier=1';

describe('lcpSpread (scripts/lhci.mjs)', () => {
  it('T-LH1 the best of five runs gates LCP; median, max and spread are reported beside it', () => {
    const runs = [2817, 1824, 2271, 2741, 2276].map((v, i) =>
      lhr(NOT_FOUND, v, 0.98, [265.4, 536, 231, 261, 360][i]),
    );
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
        gate: 'min',
        gatePasses: true,
        tbtMinMs: 231,
        tbtMedianMs: 265,
        tbtMaxMs: 536,
        tbtLimitMs: 400,
        performanceMedian: 0.98,
      },
    ]);
  });

  it('T-LH2 the gate uses its own statistic; URLs keep their own assertion level', () => {
    const runs = [
      ...[2600, 2700, 2400, 2800, 2300].map((v) => lhr(NOT_FOUND, v)),
      ...[3000, 3100, 2900].map((v) => lhr(HOME, v, 0.8)),
    ];
    const [notFound, home] = lcpSpread(runs, matrix);
    // The median (2600) is over the limit, but the gate takes the best run (2300).
    expect(notFound).toMatchObject({
      medianMs: 2600,
      gate: 'min',
      gatePasses: true,
      runsOverLimit: 3,
    });
    // Home has no aggregation option, so LHCI's median rule applies to the report.
    expect(home).toMatchObject({ runs: 3, medianMs: 3000, gate: 'median', gatePasses: false });
    const allOver = lcpSpread(
      [2600, 2700, 2550].map((v) => lhr(NOT_FOUND, v)),
      matrix,
    );
    expect(allOver[0]).toMatchObject({ gate: 'min', gatePasses: false });
  });

  it('T-LH3 runs without an LCP value are skipped; the table lists every URL', () => {
    const rows = lcpSpread(
      [lhr(NOT_FOUND, 2000), { ...lhr(NOT_FOUND, 0), audits: {} }, lhr(HOME, 1900)],
      matrix,
    );
    expect(rows.map((r) => r.runs)).toEqual([1, 1]);
    const table = spreadTable('dark', rows);
    expect(table).toContain(
      '| /qa/not-found | 1 | 2000 | 2000 | 2000 | 0 | 0 | 2500 (error) | pass (min) | 150 (150 to 150) | 400 |',
    );
    // Home has no TBT gate in phase 3; its TBT is still reported.
    expect(table).toContain('| /?tier=1 | 1 | 1900 |');
    expect(table).toMatch(/\| \/\?tier=1 \|.*\| 150 \(150 to 150\) \| none \|/);
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

describe('lighthouserc.cjs', () => {
  it('T-LH4 every collected URL matches exactly one assertion entry; content pages share the gates', () => {
    const { ci } = createRequire(import.meta.url)('../lighthouserc.cjs') as {
      ci: {
        collect: { url: string[] };
        assert: {
          assertMatrix: Array<{ matchingUrlPattern: string; assertions: Record<string, unknown> }>;
        };
      };
    };
    const entries = (url: string) =>
      ci.assert.assertMatrix.filter((m) => new RegExp(m.matchingUrlPattern).test(url));
    expect(ci.collect.url.map((url) => new URL(url).pathname + new URL(url).search)).toEqual([
      '/qa/not-found',
      encodeURI('/خدمات/ترمیم-دندان'),
      encodeURI('/پزشکان/دکتر-نمونه-آزمایشی'),
      encodeURI('/هزینه-و-پرداخت'),
      '/?tier=0',
      '/?tier=1',
    ]);
    for (const url of ci.collect.url) expect(entries(url), url).toHaveLength(1);
    const [notFound, service, dentist, pricing, tier0] = ci.collect.url.map(
      (url) => entries(url)[0]!,
    );
    expect(service!.assertions).toEqual(notFound!.assertions);
    expect(dentist!.assertions).toEqual(notFound!.assertions);
    expect(pricing!.assertions).toEqual(notFound!.assertions);
    const { 'resource-summary:script:size': homeScript, ...tier0Rest } = tier0!.assertions;
    const { 'resource-summary:script:size': contentScript, ...contentRest } = notFound!.assertions;
    expect(tier0Rest).toEqual(contentRest);
    expect(homeScript).toEqual(['error', { maxNumericValue: 215 * 1024 }]);
    expect(contentScript).toEqual(['error', { maxNumericValue: 150 * 1024 }]);
  });
});
