/**
 * Whether the light notice opens (phone spec 3.1, D27): a pure function from the tier state, the
 * intro, the session flag and the dismiss record to the copy variant, or null. It decides opening
 * only; LightNotice keeps an open notice open until «بستن» or the end of the page view, so a
 * switch (fixed mode, null here) never closes it under the finger.
 *
 * Only a decision the device made explains itself: a weak renderer or benchmark, a weak phone
 * (memory, CPU, the light floor) or the frame monitor. Reduced motion, Save-Data, the site cap, a
 * saved or query choice and no WebGL 2 never show it; phase 8 decides the context loss.
 */
import type { TierState } from './tierStore';

export type LightVariant = 'loaded' | 'stepped';

/** «بستن» keeps the notice closed for one variant until `until` (epoch ms). */
export interface DismissRecord {
  variant: LightVariant;
  until: number;
}

/** sessionStorage: the notice opened in this session. localStorage: the dismiss record. */
export const LIGHT_NOTICE_KEY = 'sefid-light-notice';
/** How long «بستن» keeps the notice closed. [guess: calibrated before step 9] */
export const LIGHT_NOTICE_MS = 30 * 24 * 60 * 60 * 1000;

const DEVICE_REASONS: ReadonlySet<TierState['reason']> = new Set([
  'software-renderer',
  'gpu-benchmark',
  'device-memory',
  'device-cpu',
  'light-floor',
  'monitor',
]);

/** Storage is a boundary: anything but a known variant and a finite time is no record. */
export function parseDismiss(raw: string | null): DismissRecord | null {
  try {
    const { variant, until } = JSON.parse(raw ?? 'null') as Partial<DismissRecord>;
    if ((variant === 'loaded' || variant === 'stepped') && Number.isFinite(until)) {
      return { variant, until: until as number };
    }
  } catch {
    // Corrupt JSON or null: no record.
  }
  return null;
}

export function lightNotice(input: {
  state: Pick<
    TierState,
    'hydrated' | 'status' | 'tier' | 'mode' | 'reason' | 'finePointer' | 'lastStep'
  >;
  introDone: boolean;
  /** The session flag: the notice already opened in this session. */
  shown: boolean;
  dismissed: DismissRecord | null;
  /** Epoch ms. */
  now: number;
}): { variant: LightVariant } | null {
  const { state, dismissed } = input;
  // 'ready' also covers a probe that was not needed (the store sets it once `load` passed).
  if (!state.hydrated || state.status !== 'ready' || !input.introDone || state.finePointer) {
    return null;
  }
  if (state.tier !== 0 || state.mode !== 'auto' || !DEVICE_REASONS.has(state.reason)) return null;
  if (input.shown) return null;
  // The store lives for one page view, so a step it recorded happened in this one.
  const variant: LightVariant = state.lastStep !== null ? 'stepped' : 'loaded';
  if (dismissed !== null && dismissed.variant === variant && input.now < dismissed.until) {
    return null;
  }
  return { variant };
}

/** The dismiss record's end: the light floor's own end when the floor caused the notice. */
export function dismissUntil(
  reason: TierState['reason'],
  now: number,
  floorUntil: number | null,
): number {
  return reason === 'light-floor' && floorUntil !== null ? floorUntil : now + LIGHT_NOTICE_MS;
}
