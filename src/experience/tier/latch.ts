/**
 * Layout latch (spec EXP 3.5.2, freeze 3.7, critic X30). A tier change moves GPU-side settings
 * at once, but the DOM layout (pins, Lenis, the master timeline) only changes when it cannot
 * move the page under the reader.
 */
import type { Tier, TierSettings } from '@/lib/qualityTier';

export interface LayoutLatch {
  pinnedScenes: boolean;
  lenis: boolean;
  latchedAtTier: Tier;
}

export type RelatchReason = 'monitor' | 'user' | 'reduced-motion' | 'resize' | 'detection';

/** No scroll for this long before a monitor drop may change the layout. */
export const RELATCH_IDLE_MS = 1000;

/** The tier 0 layout: no pins, no Lenis, no master timeline. Also the server snapshot. */
export const TIER0_LAYOUT: LayoutLatch = Object.freeze({
  pinnedScenes: false,
  lenis: false,
  latchedAtTier: 0,
});

export function latchLayout(settings: TierSettings, finePointer: boolean, tier: Tier): LayoutLatch {
  return {
    pinnedScenes: tier >= 1 && settings.pinnedScenes,
    lenis: tier >= 1 && finePointer,
    latchedAtTier: tier,
  };
}

/**
 * Whether the latched layout may change now. 'user', 'reduced-motion' and 'resize' are explicit
 * and change it at once; 'detection' (the GPU probe after load) only before the reader reaches the
 * first pinned scene; 'monitor' only outside every pinned range after 1000 ms without scrolling.
 * The caller asks for 'detection' once per page load.
 */
export function mayRelatch(s: {
  insidePinnedRange: boolean;
  reachedFirstPinnedScene: boolean;
  scrollIdleMs: number;
  reason: RelatchReason;
}): boolean {
  switch (s.reason) {
    case 'user':
    case 'reduced-motion':
    case 'resize':
      return true;
    case 'detection':
      return !s.reachedFirstPinnedScene;
    case 'monitor':
      return !s.insidePinnedRange && s.scrollIdleMs >= RELATCH_IDLE_MS;
  }
}

/** Two latches build the same DOM: same pins, same Lenis, same master timeline presence. */
export function sameLayout(a: LayoutLatch, b: LayoutLatch): boolean {
  return (
    a.pinnedScenes === b.pinnedScenes &&
    a.lenis === b.lenis &&
    a.latchedAtTier >= 1 === b.latchedAtTier >= 1
  );
}
