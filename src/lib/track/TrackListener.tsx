'use client';

import { useEffect } from 'react';

import { isEventName, track } from '@/lib/track/track';

/** Attribute value of the element or its nearest ancestor that has it. */
function closestAttr(el: Element, name: string): string | undefined {
  return el.closest(`[${name}]`)?.getAttribute(name) ?? undefined;
}

/**
 * One delegated click listener on the document (conversion.md 9): an element with
 * `data-track="<event>"` sends that event with `data-location` and `data-service-key` from the
 * element or its ancestors. Capture phase, so a handler that stops propagation cannot hide a
 * click, and the beacon leaves before a link navigates. Editors never touch JS.
 */
export function TrackListener(): null {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-track]') : null;
      if (target === null) return;
      const name = target.getAttribute('data-track');
      if (!isEventName(name)) return;
      const params: Record<string, string> = {};
      const location = closestAttr(target, 'data-location');
      const serviceKey = closestAttr(target, 'data-service-key');
      if (location) params.location = location;
      if (serviceKey) params.serviceKey = serviceKey;
      track(name, params);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}
