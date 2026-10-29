/**
 * Scene contract (spec EXP 3.10). Scroll scenes are DOM sections; a scene with `webgl` also draws
 * into the one fixed canvas. Phase 8 fills `load` and `assets`; phase 3 leaves them undefined.
 */
import type { ComponentType, Ref } from 'react';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../engine/scrollEngine';
import type { LayoutLatch } from '../tier/latch';

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

/**
 * What a DOM scene module receives (phase 7 report, plan section 3). `segment()` is the scene
 * element's own scroll range in master time units (0..1), re-read on every refresh: a nested
 * scene overlaps its parent's segment; `segment()` is the element's own range. Children added to
 * `master` during `setup` (or later, at `label`) are re-placed on every refresh: `startTime` at
 * the label, `duration` the segment length, so a sub-range lives inside the child at relative
 * positions.
 */
export interface SceneContext {
  id: SceneId;
  /** The `[data-scene]` element. */
  el: HTMLElement;
  /** Pins, Lenis, latchedAtTier: the layout decisions follow this latch, never `tier.tier`. */
  layout: LayoutLatch;
  /** heroExitParallax, heroExitMask, pointerParallax, ... (cosmetic switches). */
  settings: TierSettings;
  conditions: { reduce: boolean; fine: boolean; wide: boolean };
  /** scrollTo, onTick, sceneProgress. */
  engine: ScrollEngine;
  /** Add unpinned scrubs at `label`. */
  master: gsap.core.Timeline;
  /** The scene's label in the master. */
  label: string;
  /** Master time units 0..1, the scene element's own scroll range, re-read on refresh. */
  segment(): { start: number; end: number };
  /**
   * Exactly once, when the scene is within one viewport (an immediate check and the trigger's
   * onEnter share one guard). Returns the cancel.
   */
  nearViewport(cb: () => void): () => void;
}

/**
 * One module per scene under `scenes/dom/<id>.ts`, bundled in the engine chunk. Everything a
 * scene creates lives in the engine's matchMedia context; its own listeners, observers,
 * Draggables and delayed calls, plus every class, attribute and property it added, go in the
 * returned cleanup (`mm.revert()` undoes inline styles only). `pin` runs before the master, in
 * document order, only when the layout pins; it pins an inner element, never `el`. `setup` runs
 * on phones too and branches on `conditions.wide`, `layout.pinnedScenes` and `settings`; under
 * 1024 px its scroll-linked work is the phone scroll set (`scenes/dom/phone.ts`). The engine
 * registers ScrollTrigger one frame before creation at every tier from 1, so `setup` may create
 * triggers directly. Under 1024 px a scene beyond two viewport heights runs `setup` only when it
 * comes near, and every setup runs in a task of its own, after the engine's creation task.
 */
export interface DomScene {
  pin?(ctx: Omit<SceneContext, 'master' | 'label' | 'segment'>): void;
  setup(ctx: SceneContext): void | (() => void);
}
