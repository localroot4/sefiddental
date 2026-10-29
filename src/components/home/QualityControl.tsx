'use client';

/**
 * The «کیفیت» control of the footer stage (phase 7 report D9; spec scene 11): a radio group of
 * «خودکار» and the four tiers, server HTML enabled after hydration, that calls
 * `setUserOverride` after the next paint (the saved choice, `localStorage['sefid-quality']`; the
 * store relatches then and the root keeps the reader in place). The line under it names the
 * effective tier and, when that is not the reader's choice, why: reduced motion, the site cap,
 * Save-Data, or the device (no WebGL 2, a software renderer, little memory, a slow CPU, the light
 * floor, the frame monitor). No analytics event.
 * Every string comes from the server component as a prop: a client import of `@/i18n/fa` would
 * put the whole message map into the home initial JS (+17 KiB measured by check:bundle).
 */
import { useId, useState, useSyncExternalStore } from 'react';

import { Chip } from '@/components/ui/Field';
import { useTier } from '@/experience/tier/TierProvider';
import type { EffectiveReason } from '@/experience/tier/tierStore';
import {
  parseSavedOverride,
  QUALITY_STORAGE_KEY,
  type Tier,
  type TierOverride,
} from '@/lib/qualityTier';

const OPTIONS: readonly TierOverride[] = ['auto', 0, 1, 2, 3];
const RADIO_NAME = 'sefid-quality';

export interface QualityLabels {
  legend: string;
  auto: string;
  /** Tier 0 to 3. */
  tiers: readonly [string, string, string, string];
  reducedMotion: string;
  siteCap: string;
  device: string;
  /** Save-Data is the visitor's own setting, not the device's (phone spec 3, U-PH13). */
  saveData: string;
}

/** Why the effective tier is not what was chosen; null when it is the choice or the benchmark. */
export function whyDiffers(reason: EffectiveReason, labels: QualityLabels): string | null {
  switch (reason) {
    case 'reduced-motion':
      return labels.reducedMotion;
    case 'site-cap':
      return labels.siteCap;
    case 'save-data':
      return labels.saveData;
    case 'no-webgl2':
    case 'software-renderer':
    case 'device-memory':
    case 'device-cpu':
    case 'light-floor':
    case 'monitor':
    case 'context-loss':
      return labels.device;
    case 'user-override':
    case 'query-override':
    case 'gpu-benchmark':
      return null;
  }
}

// The saved choice is not in the tier state; it is read back from storage on every render the
// store causes (setUserOverride writes it first, then emits) and on a change from another tab.
const readChoice = (): TierOverride => {
  try {
    return parseSavedOverride(localStorage.getItem(QUALITY_STORAGE_KEY));
  } catch {
    return 'auto';
  }
};
const serverChoice = (): TierOverride => 'auto';
const subscribeStorage = (onChange: () => void): (() => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

export function QualityControl(props: { labels: QualityLabels }) {
  const { labels } = props;
  const tier = useTier();
  const choice = useSyncExternalStore(subscribeStorage, readChoice, serverChoice);
  const lineId = useId();
  // The line is live only once the reader has reached the control: the fill at hydration and a
  // monitor step-down before any interaction are not announced out of context.
  const [live, setLive] = useState(false);
  // The radio a click checked while its relatch waits for the next paint (see onChange).
  const [pending, setPending] = useState<TierOverride | null>(null);
  const tierName = (value: Tier): string => labels.tiers[value];
  const why = tier.hydrated ? whyDiffers(tier.reason, labels) : null;
  return (
    <fieldset
      className="grid min-w-0 gap-2"
      aria-describedby={lineId}
      onFocus={() => setLive(true)}
    >
      <legend className="mb-2 text-small font-semibold">{labels.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Chip
            key={String(option)}
            name={RADIO_NAME}
            value={String(option)}
            label={option === 'auto' ? labels.auto : tierName(option)}
            checked={(pending ?? choice) === option}
            disabled={!tier.hydrated}
            // The relatch (the old engine's teardown) runs in a task after the next paint, so the
            // click paints at once (desktop INP 2 → 1 was 272 ms with it in the click task).
            onChange={() => {
              setPending(option);
              requestAnimationFrame(() =>
                setTimeout(() => {
                  tier.setUserOverride(option);
                  setPending((now) => (now === option ? null : now));
                }, 0),
              );
            }}
          />
        ))}
      </div>
      <p
        id={lineId}
        aria-live={live ? 'polite' : undefined}
        className="text-caption text-ink-muted"
      >
        {tier.hydrated ? (why ? `${tierName(tier.tier)} · ${why}` : tierName(tier.tier)) : null}
      </p>
    </fieldset>
  );
}
