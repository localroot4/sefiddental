'use client';

import { useEffect } from 'react';

import { bookingRoute } from '@/components/chrome/bookingRoute';
import { isPlainClick } from '@/components/chrome/closedSheet';
import { getFormSession } from '@/components/chrome/formSession';
import type { OpenState } from '@/lib/events/allowlist';
import { isEventName, track } from '@/lib/track/track';

/**
 * PAGE_PATHS['services-hub'] plus '/' (TL6 checks it): importing src/lib/paths would ship its
 * normalizer to every page.
 */
export const SERVICES_PREFIX = '/خدمات/';

/**
 * GA4-only parameters a tracked element carries (docs/analytics.md); `from_slug` may sit on an
 * ancestor. `data-tier` is read on the element only: <html data-tier> is the quality tier.
 */
const EXTRAS = [
  ['data-provider', 'provider', false],
  ['data-tier', 'tier', false],
  ['data-from-slug', 'from_slug', true],
] as const;

/** Attribute value of the element or its nearest ancestor that has it. */
function closestAttr(el: Element, name: string): string | undefined {
  return el.closest(`[${name}]`)?.getAttribute(name) ?? undefined;
}

const decoded = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/**
 * A same-site link from a guide or an article to a service page. Rich-text links cannot carry
 * `data-track`, so this one event is recognized by where the link points (conversion.md 9).
 */
function serviceLinkFromContent(el: Element): boolean {
  const link = el.closest('a[href]');
  return (
    link instanceof HTMLAnchorElement &&
    link.origin === window.location.origin &&
    link.closest('[data-page-type="guide"], [data-page-type="article"]') !== null &&
    decoded(link.pathname).startsWith(SERVICES_PREFIX)
  );
}

/**
 * One delegated click listener on the document (conversion.md 9): an element with
 * `data-track="<event>"` sends that event with `data-location` and `data-service-key` (and the
 * EXTRAS) from the element or its ancestors; `call_click` adds the hours state as `open_state`.
 * A plain guide or article link to a service sends `content_to_service`. Capture phase, so a
 * handler that stops propagation cannot hide a click, and the beacon leaves before a link
 * navigates. Editors never touch JS.
 */
export function TrackListener(): null {
  useEffect(() => {
    // The chrome already asks for the session on every page (closed-hours sheet): same request.
    let hours: { state: OpenState; until: number } | null = null;
    const refresh = () =>
      void getFormSession().then((session) => {
        hours = session
          ? { state: session.hours.state, until: Date.parse(session.hours.nextChangeAt) }
          : null;
      });
    refresh();

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest('[data-track]');
      if (target === null) {
        if (serviceLinkFromContent(event.target)) {
          track('content_to_service', {
            location: 'article',
            from_slug:
              closestAttr(event.target, 'data-from-slug') ??
              decoded(window.location.pathname).split('/').pop() ??
              '',
          });
        }
        return;
      }
      const name = target.getAttribute('data-track');
      if (!isEventName(name)) return;
      // Freeze G8: a booking CTA counts booking_open only when it routes in the page (dialog,
      // scroll, focus); one that navigates leaves the count to the booking page view.
      if (
        name === 'booking_open' &&
        target.closest('a[data-booking-cta]') &&
        (!isPlainClick(event) || bookingRoute(document, window.innerHeight) === null)
      ) {
        return;
      }
      const params: Record<string, string> = {};
      const location = closestAttr(target, 'data-location');
      const serviceKey = closestAttr(target, 'data-service-key');
      if (location) params.location = location;
      if (serviceKey) params.serviceKey = serviceKey;
      for (const [attr, key, inherited] of EXTRAS) {
        const value = inherited ? closestAttr(target, attr) : target.getAttribute(attr);
        if (value) params[key] = value;
      }
      if (name === 'call_click') {
        // A state past its change time is stale: unknown until the session refreshes.
        const fresh = hours !== null && Date.now() < hours.until;
        params.open_state = fresh && hours ? hours.state : 'unknown';
        if (!fresh) refresh();
      }
      track(name, params);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}
