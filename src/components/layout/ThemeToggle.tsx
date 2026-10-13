'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';

import { t } from '@/i18n/fa';
import {
  applyStoredTheme,
  isDarkNow,
  isDarkOnServer,
  setTheme,
  subscribeTheme,
} from '@/lib/theme/themeStore';
import { track } from '@/lib/track/track';

/**
 * Light/dark toggle (spec 5.5): `aria-pressed` is true in dark. The icon follows CSS (the `dark:`
 * variant reads data-theme and the system preference), so the server HTML is right before
 * hydration and no flash or mismatch occurs. 44 px target; icon fade 200 ms, none under reduced
 * motion.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkNow, isDarkOnServer);
  useLayoutEffect(applyStoredTheme, []);

  const toggle = () => {
    const next = isDarkNow() ? 'light' : 'dark';
    setTheme(next);
    track('theme_toggle', { to: next, location: 'header' });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      aria-pressed={dark}
      className="inline-flex size-target items-center justify-center rounded-pill text-ink transition-colors duration-200 hover:bg-surface-sunken motion-reduce:transition-none"
    >
      {/* Moon in light (switch to dark), sun in dark (switch to light). */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-6 dark:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5a8.5 8.5 0 1 0 10.6 10.6Z" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="hidden size-6 dark:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    </button>
  );
}
