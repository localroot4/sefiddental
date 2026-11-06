import { describe, expect, it } from 'vitest';

import { tierSettings, type Tier } from '@/lib/qualityTier';

import { COURIER } from '../journey/courier';

import {
  FIRST_PINNED_SCENE,
  isSceneId,
  PLACEHOLDER_SCENE_IDS,
  SCENES,
  SCENES_LOAD_WEBGL,
  scenesDrawWebgl,
} from './registry';

describe('scene registry', () => {
  it('V7 ids are unique and order is 0..11 contiguous', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(SCENES.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('V7 desktop ranges ascend, never overlap and leave no gap', () => {
    const ranges = SCENES.flatMap((s) => (s.desktopRangeVh ? [s.desktopRangeVh] : []));
    expect(ranges[0]?.[0]).toBe(0);
    for (let i = 0; i < ranges.length; i += 1) {
      const [start, end] = ranges[i]!;
      expect(end).toBeGreaterThan(start);
      if (i > 0) expect(start).toBe(ranges[i - 1]![1]);
    }
    expect(ranges.at(-1)?.[1]).toBe(1560);
  });

  it('V7 the pinned scenes are exactly services, restoration and workflow', () => {
    expect(SCENES.filter((s) => s.pinnedDesktop).map((s) => s.id)).toEqual([
      'services',
      'restoration',
      'workflow',
    ]);
    expect(FIRST_PINNED_SCENE).toBe('services');
  });

  it('V7 three direction changes, each entering a pinned scene', () => {
    const changes = SCENES.filter((scene, i) => {
      const prev = SCENES[i - 1];
      return prev !== undefined && scene.pinnedDesktop && scene.direction !== prev.direction;
    }).map((s) => `${SCENES[s.order - 1]?.direction}->${s.direction}`);
    expect(changes).toEqual(['vertical->horizontal', 'horizontal->vertical', 'vertical->diagonal']);
  });

  it('V7 every [data-scene] id of the placeholder home exists in the registry', () => {
    expect(PLACEHOLDER_SCENE_IDS).toHaveLength(11);
    for (const id of PLACEHOLDER_SCENE_IDS) expect(isSceneId(id)).toBe(true);
    expect(PLACEHOLDER_SCENE_IDS[0]).toBe('hero');
    expect(isSceneId('nope')).toBe(false);
  });

  it('V7 a slot scene loads its chunk lazily and lists its assets; the hero never draws over the photo', () => {
    // The journey (docs/experience/journey.md): one courier replaced the per-scene objects of
    // scenes 2 to 5 and 10, so only the compare wipe is still a slot.
    const loading = SCENES.filter((s) => s.webgl?.load !== undefined).map((s) => s.id);
    expect(loading).toEqual(['compare']);
    for (const scene of SCENES) {
      if (scene.webgl?.load) expect(scene.webgl.assets).toBeTypeOf('function');
    }
    expect(SCENES_LOAD_WEBGL).toBe(true);
    expect(SCENES.find((s) => s.id === 'hero')?.webgl).toBeNull();
  });

  it('V7 the courier stations draw WebGL from tier 2; tier 1 keeps the DOM courier', () => {
    const at = (id: string) => SCENES.find((s) => s.id === id)?.webgl?.minTier;
    for (const id of ['trust', 'services', 'restoration', 'workflow', 'booking']) {
      expect(at(id), id).toBe(COURIER.minTier);
    }
    expect(COURIER.minTier).toBe(2);
    const bytes = COURIER.assets().reduce((sum, item) => sum + item.bytes, 0);
    expect(bytes).toBeLessThan(500 * 1024);
  });

  it('V7 every scene with a loader declares its downloads, none over the tier 1 budget', () => {
    for (const scene of SCENES) {
      if (scene.webgl?.load === undefined) continue;
      const manifest = scene.webgl.assets?.(1);
      expect(manifest, scene.id).toBeDefined();
      const bytes = (manifest ?? []).reduce((sum, item) => sum + item.bytes, 0);
      expect(bytes, scene.id).toBeLessThan(500 * 1024);
    }
  });

  it('the canvas has work at tiers 2 and 3 at any width (the courier), never at tier 1 or 0', () => {
    const desktop = (tier: Tier) => tierSettings(tier, { width: 1440, height: 900, dpr: 1 }, true);
    const phone = (tier: Tier) => tierSettings(tier, { width: 390, height: 844, dpr: 3 }, false);
    expect(scenesDrawWebgl(2, phone(2))).toBe(true);
    expect(scenesDrawWebgl(3, desktop(3))).toBe(true);
    expect(scenesDrawWebgl(0, desktop(0))).toBe(false);
    // Tier 1 runs the DOM courier: no three.js, on a phone or a desktop.
    expect(scenesDrawWebgl(1, phone(1))).toBe(false);
    expect(scenesDrawWebgl(1, desktop(1))).toBe(false);
  });
});
