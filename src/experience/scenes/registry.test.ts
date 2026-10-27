import { describe, expect, it } from 'vitest';

import {
  FIRST_PINNED_SCENE,
  isSceneId,
  PLACEHOLDER_SCENE_IDS,
  SCENES,
  SCENES_LOAD_WEBGL,
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

  it('V7 no scene loads WebGL in phase 3; the hero never draws over the photo', () => {
    for (const scene of SCENES) expect(scene.webgl?.load).toBeUndefined();
    expect(SCENES_LOAD_WEBGL).toBe(false);
    expect(SCENES.find((s) => s.id === 'hero')?.webgl).toBeNull();
  });
});
