'use client';

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';

import type { EventLocation } from '@/lib/events/allowlist';
import {
  applyStoredTheme,
  isDarkNow,
  isDarkOnServer,
  setTheme,
  subscribeTheme,
} from '@/lib/theme/themeStore';
import { track } from '@/lib/track/track';

/**
 * Light/dark toggle (spec 5.5): `aria-pressed` is true in dark. The label and the two icons come
 * from the server parent (ThemeIcons), so the island ships no strings and no icon code; the icon
 * morph follows CSS (the `dark:` variant), so the server HTML is right before hydration.
 */
export function ThemeToggle(props: {
  label: string;
  location: Extract<EventLocation, 'header' | 'drawer'>;
  children: ReactNode;
}) {
  const dark = useSyncExternalStore(subscribeTheme, isDarkNow, isDarkOnServer);
  useLayoutEffect(applyStoredTheme, []);

  const toggle = () => {
    const next = isDarkNow() ? 'light' : 'dark';
    setTheme(next);
    track('theme_toggle', { to: next, location: props.location });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={props.label}
      aria-pressed={dark}
      className="relative inline-grid size-target place-items-center rounded-pill text-ink transition-[background-color,scale] hover:bg-brand-soft active:scale-[.98]"
    >
      {props.children}
    </button>
  );
}
