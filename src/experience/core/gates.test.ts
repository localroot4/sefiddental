import { describe, expect, it } from 'vitest';

import { canMount, coverRanges, gateState, isCovered } from './gates';

describe('canMount', () => {
  it('V1 truth table: only loaded, intro done, tier >= 1 and visible mounts', () => {
    const bools = [false, true];
    for (const loaded of bools) {
      for (const introDone of bools) {
        for (const visible of bools) {
          for (const tier of [0, 1, 2, 3] as const) {
            const expected = loaded && introDone && visible && tier >= 1;
            expect(canMount({ loaded, introDone, tier, visible })).toBe(expected);
          }
        }
      }
    }
  });
});

describe('coverRanges and isCovered', () => {
  it('V2 hero 900 px tall in a 900 px viewport: covered at 0, open at 1', () => {
    const ranges = coverRanges([{ top: 0, height: 900 }], 900);
    expect(ranges).toEqual([{ start: 0, end: 0 }]);
    expect(isCovered(0, ranges)).toBe(true);
    expect(isCovered(1, ranges)).toBe(false);
  });

  it('V2 a taller cover stays covered until its bottom meets the viewport bottom', () => {
    const ranges = coverRanges([{ top: 0, height: 1500 }], 900);
    expect(isCovered(600, ranges)).toBe(true);
    expect(isCovered(601, ranges)).toBe(false);
  });

  it('V2 a cover shorter than the viewport never covers', () => {
    const ranges = coverRanges([{ top: 0, height: 899 }], 900);
    expect(ranges).toEqual([]);
    expect(isCovered(0, ranges)).toBe(false);
  });

  it('V2 two covers give two ranges', () => {
    const ranges = coverRanges(
      [
        { top: 0, height: 900 },
        { top: 2000, height: 1200 },
      ],
      900,
    );
    expect(ranges).toEqual([
      { start: 0, end: 0 },
      { start: 2000, end: 2300 },
    ]);
    expect(isCovered(1000, ranges)).toBe(false);
    expect(isCovered(2000, ranges)).toBe(true);
    expect(isCovered(2300, ranges)).toBe(true);
    expect(isCovered(2301, ranges)).toBe(false);
  });

  it('V2 a zero or invalid viewport gives no ranges', () => {
    expect(coverRanges([{ top: 0, height: 900 }], 0)).toEqual([]);
    expect(coverRanges([{ top: Number.NaN, height: 900 }], 900)).toEqual([]);
  });
});

describe('gateState', () => {
  it('V3 precedence lost > hidden > not-mounted > covered > open', () => {
    const all = { mounted: false, covered: true, visible: false, contextLost: true };
    expect(gateState(all)).toBe('lost');
    expect(gateState({ ...all, contextLost: false })).toBe('hidden');
    expect(gateState({ ...all, contextLost: false, visible: true })).toBe('not-mounted');
    expect(gateState({ mounted: true, covered: true, visible: true, contextLost: false })).toBe(
      'covered',
    );
    expect(gateState({ mounted: true, covered: false, visible: true, contextLost: false })).toBe(
      'open',
    );
  });
});
