/**
 * Pure gates for the home canvas (spec EXP 3.3-3.4). No window access: callers pass measured
 * values, so the rules are unit-tested in node.
 */
import type { Tier } from '@/lib/qualityTier';

/** Why the canvas does or does not render a frame on this tick. */
export type Gate = 'not-mounted' | 'covered' | 'open' | 'hidden' | 'lost';

/** Document scrollY range in which one cover fills the whole viewport. */
export interface CoverRange {
  start: number;
  end: number;
}

/** The canvas mounts after `load`, after the intro, at tier 1 or more, in a visible tab. */
export function canMount(s: {
  loaded: boolean;
  introDone: boolean;
  tier: Tier;
  visible: boolean;
}): boolean {
  return s.loaded && s.introDone && s.tier >= 1 && s.visible;
}

/**
 * One range per cover that is at least as tall as the viewport: from its top to the scroll
 * position where its bottom edge meets the viewport bottom. Shorter covers never cover.
 */
export function coverRanges(
  covers: readonly { top: number; height: number }[],
  viewportHeight: number,
): CoverRange[] {
  const ranges: CoverRange[] = [];
  if (!(viewportHeight > 0)) return ranges;
  for (const cover of covers) {
    if (!(cover.height >= viewportHeight) || !Number.isFinite(cover.top)) continue;
    ranges.push({ start: cover.top, end: cover.top + cover.height - viewportHeight });
  }
  return ranges;
}

/** Inclusive on both ends: at scrollY 0 a viewport-tall hero covers the world. */
export function isCovered(scrollY: number, ranges: readonly CoverRange[]): boolean {
  return ranges.some((range) => scrollY >= range.start && scrollY <= range.end);
}

/** Precedence: lost > hidden > not-mounted > covered > open. */
export function gateState(s: {
  mounted: boolean;
  covered: boolean;
  visible: boolean;
  contextLost: boolean;
}): Gate {
  if (s.contextLost) return 'lost';
  if (!s.visible) return 'hidden';
  if (!s.mounted) return 'not-mounted';
  if (s.covered) return 'covered';
  return 'open';
}
