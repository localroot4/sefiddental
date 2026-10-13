import { describe, expect, it } from 'vitest';

import { isMounted, slotState } from './lifecycle';

const base = {
  tier: 3,
  minTier: 2,
  hasLoader: true,
  sceneIndex: 5,
  activeIndex: 5,
  loaded: true,
} as const;

describe('slotState', () => {
  it('L1 loads one scene ahead and is active inside its own segment', () => {
    expect(slotState({ ...base, activeIndex: 4, loaded: false })).toBe('loading');
    expect(slotState({ ...base, activeIndex: 4 })).toBe('ready');
    expect(slotState(base)).toBe('active');
    expect(slotState({ ...base, activeIndex: 6 })).toBe('ready');
  });

  it('L2 two or more scenes away disposes a loaded scene and leaves an unloaded one idle', () => {
    expect(slotState({ ...base, activeIndex: 7 })).toBe('disposed');
    expect(slotState({ ...base, activeIndex: 3 })).toBe('disposed');
    expect(slotState({ ...base, activeIndex: 2, loaded: false })).toBe('idle');
  });

  it('L3 a tier below minTier disposes; no loader or no WebGL stays idle', () => {
    expect(slotState({ ...base, tier: 1 })).toBe('disposed');
    expect(slotState({ ...base, hasLoader: false, loaded: false })).toBe('idle');
    expect(slotState({ ...base, minTier: null, loaded: false })).toBe('idle');
  });

  it('L4 only ready and active mount the component', () => {
    expect(
      ['idle', 'loading', 'ready', 'active', 'disposed'].map((s) => isMounted(s as never)),
    ).toEqual([false, false, true, true, false]);
  });
});
