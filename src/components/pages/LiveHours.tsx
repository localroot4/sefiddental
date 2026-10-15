'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { getFormSession } from '@/components/chrome/formSession';
import type { HoursStateName } from '@/lib/hoursState';

/**
 * Today's hours state on the address page. It never sits in the server HTML (CC-6): it comes from
 * the page's one /api/form-session request after `load`, and refreshes when the state changes
 * (opening or closing time). Until then the `pending` badge (a skeleton) holds the reserved box;
 * if the request fails the box stays empty, so nothing shifts either way. The badges arrive
 * rendered from the server parent, so the island ships no labels and no icon code (F2).
 */
export function LiveHours(props: { badges: Record<HoursStateName | 'pending', ReactNode> }) {
  // undefined: waiting; null: no answer.
  const [state, setState] = useState<HoursStateName | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = () =>
      void getFormSession().then((session) => {
        if (!alive) return;
        setState(session?.hours.state ?? null);
        const wait = session ? Date.parse(session.hours.nextChangeAt) - Date.now() : Number.NaN;
        // setTimeout fires at once for a delay above 2^31 - 1 ms.
        if (wait > 0 && wait < 2 ** 31) timer = window.setTimeout(load, wait + 1000);
      });
    load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);
  // HoursTable's status box is the flex box that holds the skeleton and the badge at 32 px.
  return state === null ? null : props.badges[state ?? 'pending'];
}
