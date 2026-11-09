import { describe, expect, it } from 'vitest';

import { bezier, RESTORE_S, restoreParts } from './restore';

describe('D3 restoration per level (the top view keyframes, globals.css courier-top)', () => {
  it('RS1 the easing is the CSS cubic-bezier: its ends, and ease-out ahead of linear', () => {
    const out = bezier(0.16, 1, 0.3, 1);
    expect(out(0)).toBe(0);
    expect(out(1)).toBe(1);
    expect(out(0.25)).toBeGreaterThan(0.6);
    const inOut = bezier(0.65, 0, 0.35, 1);
    expect(inOut(0.5)).toBeCloseTo(0.5, 3);
    expect(inOut(0.2)).toBeLessThan(0.1);
  });

  it('RS2 معمولی: the cavity outline draws in 500 ms, then one composite fill fades in', () => {
    expect(restoreParts(0, 0)).toMatchObject({ outline: 0, fill: 0 });
    const mid = restoreParts(0, 0.3);
    expect(mid.outline).toBeGreaterThan(0.5);
    expect(mid.fill).toBe(0);
    expect(restoreParts(0, 0.5).outline).toBe(1);
    expect(restoreParts(0, 0.6).fill).toBeGreaterThan(0);
    expect(restoreParts(0, RESTORE_S)).toMatchObject({
      outline: 1,
      fill: 1,
      inlay: { opacity: 0 },
    });
  });

  it('RS3 VIP: the inlay comes down turned, seats with a click (a dip under its size) and a gloss passes', () => {
    const start = restoreParts(1, 0).inlay;
    expect(start).toMatchObject({ opacity: 0, y: -16, rot: -14, scale: 1.14 });
    const landed = restoreParts(1, 0.49).inlay;
    expect(landed.opacity).toBeCloseTo(1, 5);
    expect(landed.y).toBeCloseTo(0, 5);
    expect(landed.scale).toBeCloseTo(1.02, 5);
    // The click: 82 % of 700 ms.
    expect(restoreParts(1, 0.574).inlay.scale).toBeCloseTo(0.97, 5);
    expect(restoreParts(1, 0.7).inlay).toMatchObject({ opacity: 1, y: 0, rot: 0, scale: 1 });
    expect(restoreParts(1, 0.6).gloss.opacity).toBe(0);
    expect(restoreParts(1, 0.65 + 0.36).gloss.opacity).toBeCloseTo(0.55, 2);
    expect(restoreParts(1, RESTORE_S).gloss.opacity).toBe(0);
    expect(restoreParts(1, RESTORE_S)).toMatchObject({ outline: 0, fill: 0, dentine: 0 });
  });

  it('RS4 CIP: dentine, then a translucent enamel layer, then the fissures stained by hand, then a slow shimmer', () => {
    const at = (t: number) => restoreParts(2, t);
    expect(at(0)).toMatchObject({ dentine: 0, enamel: 0, stain: 0 });
    expect(at(0.35).dentine).toBe(1);
    expect(at(0.3).enamel).toBe(0);
    expect(at(0.75).enamel).toBe(1);
    expect(at(0.7).stain).toBe(0);
    expect(at(1.0).stain).toBeGreaterThan(0.3);
    expect(at(1.4).stain).toBe(1);
    expect(at(1.3).shimmer.opacity).toBe(0);
    expect(at(1.3 + 0.64).shimmer.opacity).toBeCloseTo(0.55, 2);
    expect(at(RESTORE_S)).toMatchObject({
      dentine: 1,
      enamel: 1,
      stain: 1,
      shimmer: { opacity: 0 },
    });
    expect(at(RESTORE_S).inlay.opacity).toBe(0);
  });

  it('RS5 every part holds its end state from RESTORE_S on, and before 0 holds its start', () => {
    for (const level of [0, 1, 2] as const) {
      expect(restoreParts(level, RESTORE_S + 10)).toEqual(restoreParts(level, RESTORE_S));
      expect(restoreParts(level, -1)).toEqual(restoreParts(level, 0));
    }
  });
});
