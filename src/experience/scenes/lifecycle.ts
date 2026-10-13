/**
 * Scene slot lifecycle (spec EXP 3.10): load one scene ahead in scroll order, keep the
 * neighbours mounted, dispose two or more scenes away ("far out of view") or below `minTier`.
 */
import type { Tier } from '@/lib/qualityTier';

export type SlotState = 'idle' | 'loading' | 'ready' | 'active' | 'disposed';

export function slotState(s: {
  tier: Tier;
  /** null: the scene draws nothing in WebGL. */
  minTier: 1 | 2 | 3 | null;
  /** False until phase 8 gives the scene a loader. */
  hasLoader: boolean;
  /** Index of the scene and of the master timeline's active scene, in registry order. */
  sceneIndex: number;
  activeIndex: number;
  /** The scene module has resolved at least once (it stays cached after a dispose). */
  loaded: boolean;
}): SlotState {
  const wanted =
    s.minTier !== null &&
    s.hasLoader &&
    s.tier >= s.minTier &&
    Math.abs(s.sceneIndex - s.activeIndex) <= 1;
  if (!wanted) return s.loaded ? 'disposed' : 'idle';
  if (!s.loaded) return 'loading';
  return s.sceneIndex === s.activeIndex ? 'active' : 'ready';
}

/** The scene component is mounted in these states. */
export function isMounted(state: SlotState): boolean {
  return state === 'ready' || state === 'active';
}
