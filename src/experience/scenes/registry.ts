/**
 * Scene registry, storyboard order (docs/experience/storyboard.md overview table). Phase 3
 * values: no scene loads WebGL yet (`webgl.load` stays undefined until phase 8).
 */
import type { SceneDefinition, SceneId } from './types';

export const SCENES: readonly SceneDefinition[] = Object.freeze([
  {
    id: 'intro',
    order: 0,
    desktopRangeVh: null,
    pinnedDesktop: false,
    direction: 'none',
    webgl: null,
  },
  {
    id: 'hero',
    order: 1,
    desktopRangeVh: [0, 100],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: null,
  },
  {
    id: 'trust',
    order: 2,
    desktopRangeVh: [100, 140],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 1 },
  },
  {
    id: 'services',
    order: 3,
    desktopRangeVh: [140, 440],
    pinnedDesktop: true,
    direction: 'horizontal',
    webgl: { minTier: 2 },
  },
  {
    id: 'restoration',
    order: 4,
    desktopRangeVh: [440, 640],
    pinnedDesktop: true,
    direction: 'vertical',
    webgl: { minTier: 1 },
  },
  {
    id: 'workflow',
    order: 5,
    desktopRangeVh: [640, 940],
    pinnedDesktop: true,
    direction: 'diagonal',
    webgl: { minTier: 2 },
  },
  {
    id: 'compare',
    order: 6,
    desktopRangeVh: [940, 1040],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 2 },
  },
  {
    id: 'dentists',
    order: 7,
    desktopRangeVh: [1040, 1140],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: null,
  },
  {
    id: 'voices',
    order: 8,
    desktopRangeVh: [1140, 1240],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 2 },
  },
  {
    id: 'first-visit',
    order: 9,
    desktopRangeVh: [1240, 1360],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 1 },
  },
  {
    id: 'booking',
    order: 10,
    desktopRangeVh: [1360, 1460],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 1 },
  },
  {
    id: 'footer',
    order: 11,
    desktopRangeVh: [1460, 1560],
    pinnedDesktop: false,
    direction: 'vertical',
    webgl: { minTier: 3 },
  },
] satisfies SceneDefinition[]);

/**
 * A scene draws WebGL (phase 8), so tier 1 mounts the canvas too: ExperienceRoot loads it (D5)
 * and the tier store confirms WebGL 2 on the main thread first.
 */
export const SCENES_LOAD_WEBGL = SCENES.some((scene) => scene.webgl?.load !== undefined);

const IDS: ReadonlySet<string> = new Set(SCENES.map((scene) => scene.id));

export function isSceneId(value: string): value is SceneId {
  return IDS.has(value);
}

/** The first scene a desktop layout pins; the 'detection' relatch is allowed only before it. */
export const FIRST_PINNED_SCENE: SceneId =
  SCENES.find((scene) => scene.pinnedDesktop)?.id ?? 'services';

/** The ids the home placeholder renders as `[data-scene]` sections (the intro is an overlay). */
export const PLACEHOLDER_SCENE_IDS: readonly SceneId[] = SCENES.filter(
  (scene) => scene.desktopRangeVh !== null,
).map((scene) => scene.id);
