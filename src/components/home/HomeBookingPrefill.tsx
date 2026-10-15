'use client';

import { useEffect } from 'react';

import { BOOKING_FIELDS as F } from '@/components/booking/fields';
import { track } from '@/lib/track/track';

/** Tier steps that send tier_select: home scene 4 and RestorationTiers (TIER_INPUT; RS3). */
const TIER_INPUTS = new Set(['home-tier', 'restoration-tier']);

/**
 * CTAs that carry a choice (`?service=restoration&tier=vip`: the home scene 4 step, the
 * restoration comparison on the restoration and pricing pages) fill it into the page's full
 * booking form before the chrome's booking route (src/components/chrome/bookingRoute.ts,
 * `data-booking-cta`) scrolls there (nav-conversion-hero 4). Capture phase, so the values are in
 * place before that bubble-phase handler moves focus. The link itself stays a real link. A CTA
 * without a service (the header's) leaves the form as the page set it. It also sends
 * `tier_select` with the chosen tier (CV9), once per change of a tier radio.
 */
export function HomeBookingPrefill(): null {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest('a[data-booking-cta]') : null;
      const form = document.querySelector(
        '[data-booking-form]:not([data-booking-form="hero"]) form',
      );
      if (!(link instanceof HTMLAnchorElement) || !(form instanceof HTMLFormElement)) return;
      const params = new URL(link.href).searchParams;
      const service = params.get('service');
      if (!service) return;
      const set = (name: string, value: string) => {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = value;
      };
      set(F.tier, params.get('tier') ?? '');
      set(F.serviceKey, service);
      const group = link.dataset.bookingGroup;
      const chip = group
        ? form.querySelector<HTMLInputElement>(
            `input[name="${F.service}"][value="${CSS.escape(group)}"]`,
          )
        : null;
      if (chip) chip.checked = true;
    };
    const onChange = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && TIER_INPUTS.has(input.name)) {
        track('tier_select', { location: 'tier', tier: input.value });
      }
    };
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('change', onChange);
    };
  }, []);
  return null;
}
