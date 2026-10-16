'use client';

import { useEffect } from 'react';

import { track } from '@/lib/track/track';

/** Tier steps that send tier_select: home scene 4 and RestorationTiers (TIER_INPUT; RS3). */
const TIER_INPUTS = new Set(['home-tier', 'restoration-tier']);

/**
 * Sends `tier_select` with the chosen tier (CV9), once per change of a tier radio. The chrome's
 * booking route (src/components/chrome/bookingRoute.ts, `prefill`) fills a CTA's choice into the
 * form it routes to.
 */
export function HomeBookingPrefill(): null {
  useEffect(() => {
    const onChange = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && TIER_INPUTS.has(input.name)) {
        track('tier_select', { location: 'tier', tier: input.value });
      }
    };
    document.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('change', onChange);
    };
  }, []);
  return null;
}
