'use client';

import { Activity, lazy, type ComponentType } from 'react';

import type QualityControl from './QualityControl';

type Props = Parameters<typeof QualityControl>[0];

const load = () => import('./QualityControl');

// One task after `load`: check:bundle counts a chunk that starts inside the load event.
const afterLoad = () =>
  new Promise((resolve) => {
    if (document.readyState === 'complete') setTimeout(resolve);
    else window.addEventListener('load', () => setTimeout(resolve)); // `load` fires once
  });

// The server has no `load`: it imports at once and renders the same HTML as the eager island. A
// failed import renders nothing instead of the route's error page.
const Island = lazy<ComponentType<Props>>(() =>
  typeof window === 'undefined'
    ? load()
    : afterLoad()
        .then(load)
        .catch((error: unknown) => {
          console.error(error); // the ChunkLoadError names the chunk
          return { default: () => null };
        }),
);

/**
 * The «کیفیت» island (QualityControl), fetched after `load` and one task, so it stays out of the
 * home initial JS (check:bundle home was 160.8 KiB with it, target 160). Until it arrives React
 * keeps the server fieldset (its radios are disabled until hydration either way); then the island
 * renders the same markup in its place, so nothing moves. An Activity, not a Suspense, as in
 * BookingFormIslandDeferred: the server HTML stays in place while it waits.
 */
export function QualityControlDeferred(props: Props) {
  return (
    <Activity>
      <Island {...props} />
    </Activity>
  );
}
