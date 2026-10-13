import { describe, expect, it } from 'vitest';

import { tierSettings } from '@/lib/qualityTier';

import { latchLayout, mayRelatch, RELATCH_IDLE_MS, sameLayout, TIER0_LAYOUT } from './latch';

const desktop = { width: 1440, height: 900, dpr: 1 };
const phone = { width: 390, height: 844, dpr: 3 };

describe('latchLayout', () => {
  it('V5 tier 3 on a wide fine-pointer screen pins and smooths', () => {
    expect(latchLayout(tierSettings(3, desktop, true), true, 3)).toEqual({
      pinnedScenes: true,
      lenis: true,
      latchedAtTier: 3,
    });
  });

  it('V5 tier 1 keeps Lenis on a fine pointer but has no pins', () => {
    expect(latchLayout(tierSettings(1, desktop, true), true, 1)).toEqual({
      pinnedScenes: false,
      lenis: true,
      latchedAtTier: 1,
    });
  });

  it('V5 phones (coarse pointer, narrow) get neither pins nor Lenis', () => {
    expect(latchLayout(tierSettings(3, phone, false), false, 3)).toEqual({
      pinnedScenes: false,
      lenis: false,
      latchedAtTier: 3,
    });
  });

  it('V5 tier 0 equals the tier 0 layout', () => {
    expect(latchLayout(tierSettings(0, desktop, true), true, 0)).toEqual(TIER0_LAYOUT);
  });
});

describe('mayRelatch', () => {
  const base = { insidePinnedRange: true, reachedFirstPinnedScene: true, scrollIdleMs: 0 };

  it('V5 user, reduced-motion and resize relatch at once, even inside a pin', () => {
    expect(mayRelatch({ ...base, reason: 'user' })).toBe(true);
    expect(mayRelatch({ ...base, reason: 'reduced-motion' })).toBe(true);
    expect(mayRelatch({ ...base, reason: 'resize' })).toBe(true);
  });

  it('V5 monitor waits for a position outside every pin and 1000 ms of no scroll', () => {
    expect(mayRelatch({ ...base, reason: 'monitor' })).toBe(false);
    expect(
      mayRelatch({
        ...base,
        insidePinnedRange: false,
        scrollIdleMs: RELATCH_IDLE_MS - 1,
        reason: 'monitor',
      }),
    ).toBe(false);
    expect(
      mayRelatch({ ...base, insidePinnedRange: true, scrollIdleMs: 5000, reason: 'monitor' }),
    ).toBe(false);
    expect(
      mayRelatch({
        ...base,
        insidePinnedRange: false,
        scrollIdleMs: RELATCH_IDLE_MS,
        reason: 'monitor',
      }),
    ).toBe(true);
  });

  it('V5 detection relatches only before the first pinned scene (X30)', () => {
    expect(mayRelatch({ ...base, reachedFirstPinnedScene: false, reason: 'detection' })).toBe(true);
    expect(mayRelatch({ ...base, reachedFirstPinnedScene: true, reason: 'detection' })).toBe(false);
  });
});

describe('sameLayout', () => {
  it('V5 ignores the tier number but not the master timeline presence', () => {
    const t2 = { pinnedScenes: true, lenis: true, latchedAtTier: 2 as const };
    const t3 = { ...t2, latchedAtTier: 3 as const };
    expect(sameLayout(t2, t3)).toBe(true);
    const t1Coarse = { pinnedScenes: false, lenis: false, latchedAtTier: 1 as const };
    expect(sameLayout(t1Coarse, TIER0_LAYOUT)).toBe(false);
    expect(sameLayout(t2, { ...t2, pinnedScenes: false })).toBe(false);
  });
});
