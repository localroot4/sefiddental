'use client';

import { Activity, Component, lazy, type ReactNode } from 'react';

import type { BookingFormIsland } from './BookingFormIsland';

const load = () => import('./BookingFormIsland').then((m) => ({ default: m.BookingFormIsland }));

const afterLoad = () =>
  new Promise<void>((resolve) => {
    const next = () => setTimeout(resolve, 0);
    if (document.readyState === 'complete') next();
    else window.addEventListener('load', next, { once: true });
  });

// The server has no `load`: it imports at once and renders the same HTML as the eager island.
const Island = lazy(() => (typeof window === 'undefined' ? load() : afterLoad().then(load)));

/**
 * A failed import (a chunk gone after a deploy, the network) renders nothing here instead of the
 * route's error page: the dialog then has no form that is the island's, so its links navigate
 * (src/components/chrome/bookingRoute.ts). React still reports the error (onCaughtError).
 */
class IslandFailed extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The booking dialog's island (the dialog is closed at load), fetched after `load` and one task,
 * so it stays out of the page's initial JS. Until it arrives React keeps the server form as it
 * is, it posts without JavaScript and the «رزرو نوبت» links navigate (bookingRoute). The boundary
 * is an Activity, not a Suspense: React 19 moves a large Suspense boundary's server HTML to the
 * end of the body and reveals it with an inline script, while an Activity stays in place and still
 * waits, dehydrated, for the island.
 */
export function BookingFormIslandDeferred(props: Parameters<typeof BookingFormIsland>[0]) {
  return (
    <IslandFailed>
      <Activity>
        <Island {...props} />
      </Activity>
    </IslandFailed>
  );
}
