/**
 * Scene contract (spec EXP 3.10). Scroll scenes are DOM sections; a scene with `webgl` also draws
 * into the one fixed canvas. Phase 8 fills `load` and `assets`; phase 3 leaves them undefined.
 */
import type { ComponentType, Ref } from 'react';

import type { TierSettings } from '@/lib/qualityTier';

export type SceneId =
  | 'intro'
  | 'hero'
  | 'trust'
  | 'services'
  | 'restoration'
  | 'workflow'
  | 'compare'
  | 'dentists'
  | 'voices'
  | 'first-visit'
  | 'booking'
  | 'footer';

/** One downloadable WebGL asset (glb, ktx2) and its transfer size, for the tier budgets. */
export interface AssetManifestEntry {
  url: string;
  bytes: number;
}
export type AssetManifest = readonly AssetManifestEntry[];

/** Returned through `ref` by every scene component; frees what R3F does not dispose itself. */
export interface SceneHandle {
  dispose(): void;
}

export interface SceneProps {
  id: SceneId;
  tier: 1 | 2 | 3;
  settings: TierSettings;
  /** 0..1 inside the scene's segment; read per frame, never stored in React state. */
  progress: () => number;
  /** True while the master timeline is inside the scene's segment. */
  active: () => boolean;
  ref?: Ref<SceneHandle>;
}

export interface SceneDefinition {
  id: SceneId;
  /** 0..11, storyboard numbering. */
  order: number;
  /** Desktop target range in viewport heights from the document top; null for the overlay. */
  desktopRangeVh: readonly [number, number] | null;
  pinnedDesktop: boolean;
  direction: 'none' | 'vertical' | 'horizontal' | 'diagonal';
  webgl: null | {
    minTier: 1 | 2 | 3;
    load?: () => Promise<{ default: ComponentType<SceneProps> }>;
    assets?: (tier: 1 | 2 | 3) => AssetManifest;
  };
}
