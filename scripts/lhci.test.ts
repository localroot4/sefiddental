import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { cpuMultiplierFor, lcpSpread, shiftCulprits, spreadTable, tbtGate } from './lhci.mjs';

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

describe('tbtGate (scripts/lhci.mjs, docs/brief.md section 7)', () => {
  const FLOOR = 'http://localhost:3000/qa/floor';
  const rows = (floorTbt: number[], pageTbt: number[]) =>
    lcpSpread(
      [
        ...floorTbt.map((tbt) => lhr(FLOOR, 1500, 1, tbt)),
        ...pageTbt.map((tbt) => lhr(NOT_FOUND, 2000, 0.9, tbt)),
        lhr(HOME, 2000, 0.8, 900),
      ],
      matrix,
    );

  it('T-LH5 a gated median passes within the limit or the floor median plus the allowance', () => {
    // Fast host: floor 100, the 400 limit decides; 434 fails.
    let gate = tbtGate(rows([100, 90, 110], [434, 401, 453]), '/qa/floor', 250);
    expect(gate.floorMs).toBe(100);
    expect(gate.rows.find((r) => r.url === NOT_FOUND)).toMatchObject({
      tbtGateMs: 400,
      tbtPasses: false,
    });
    // Slow host: floor 200, the gate rises to 450; the same 434 passes.
    gate = tbtGate(rows([200, 190, 210], [434, 401, 453]), '/qa/floor', 250);
    expect(gate.rows.find((r) => r.url === NOT_FOUND)).toMatchObject({
      tbtGateMs: 450,
      tbtPasses: true,
    });
    // Ungated URLs (home, the floor itself) always pass; the table marks a failure.
    expect(gate.rows.filter((r) => r.tbtGateMs === null).map((r) => r.url)).toEqual([FLOOR, HOME]);
    const failing = tbtGate(rows([200], [500]), '/qa/floor', 250);
    expect(spreadTable('light', failing.rows)).toContain('| 450 FAIL |');
  });

  it('T-LH6 no floor runs: the limit alone; a gated URL without TBT fails', () => {
    const noFloor = tbtGate(lcpSpread([lhr(NOT_FOUND, 2000, 0.9, 420)], matrix), '/qa/floor', 250);
    expect(noFloor.floorMs).toBeNull();
    expect(noFloor.rows[0]).toMatchObject({ tbtGateMs: 400, tbtPasses: false });
    const noTbt = {
      ...lhr(NOT_FOUND, 2000),
      audits: { 'largest-contentful-paint': { numericValue: 2000 } },
    };
    expect(tbtGate(lcpSpread([noTbt], matrix), '/qa/floor', 250).rows[0]).toMatchObject({
      tbtMedianMs: null,
      tbtPasses: false,
    });
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
      '/qa/floor',
      '/qa/not-found',
      encodeURI('/خدمات/ترمیم-دندان'),
      encodeURI('/پزشکان/دکتر-نمونه-آزمایشی'),
      encodeURI('/هزینه-و-پرداخت'),
      encodeURI('/رزرو-نوبت'),
      encodeURI('/اورژانس'),
      '/?tier=0',
      '/?tier=1',
    ]);
    for (const url of ci.collect.url) expect(entries(url), url).toHaveLength(1);
    const [floor, notFound, service, dentist, pricing, booking, emergency, tier0] =
      ci.collect.url.map((url) => entries(url)[0]!);
    // The floor is measured, never asserted; content TBT only warns in LHCI (tbtGate gates it).
    expect(floor!.assertions).toEqual({});
    expect(notFound!.assertions['total-blocking-time']).toEqual([
      'warn',
      { maxNumericValue: 400, aggregationMethod: 'median' },
    ]);
    for (const page of [booking, emergency]) {
      const { 'resource-summary:script:size': script, ...rest } = page!.assertions;
      const { 'resource-summary:script:size': _content, ...contentRest } = notFound!.assertions;
      expect(rest).toEqual(contentRest);
      // The booking class adds the deferred dialog island's allowance (limits.json deferredKiB);
      // every class adds the script response headers Lighthouse counts (scriptHeadersKiB).
      expect(script).toEqual(['error', { maxNumericValue: (150 + 5 + 1) * 1024 }]);
    }
    expect(service!.assertions).toEqual(notFound!.assertions);
    expect(dentist!.assertions).toEqual(notFound!.assertions);
    expect(pricing!.assertions).toEqual(notFound!.assertions);
    const { 'resource-summary:script:size': homeScript, ...tier0Rest } = tier0!.assertions;
    const { 'resource-summary:script:size': contentScript, ...contentRest } = notFound!.assertions;
    expect(tier0Rest).toEqual(contentRest);
    expect(homeScript).toEqual(['error', { maxNumericValue: (215 + 1) * 1024 }]);
    expect(contentScript).toEqual(['error', { maxNumericValue: (150 + 1) * 1024 }]);
  });
});

describe('shiftCulprits', () => {
  it('LH-CLS names the moved elements of each run with a shift, for that URL only', () => {
    const run = (url: string, items: { node?: { selector: string }; score: number }[]) => ({
      requestedUrl: url,
      audits: { 'layout-shifts': { details: { items } } },
    });
    const lhrs = [
      run('https://x/?tier=0', [{ node: { selector: 'section.hero > h1' }, score: 0.5771 }]),
      run('https://x/?tier=0', []),
      run('https://x/other', [{ node: { selector: 'main' }, score: 0.2 }]),
    ];
    expect(shiftCulprits(lhrs, 'https://x/?tier=0')).toEqual(['section.hero > h1 0.577']);
  });
});
