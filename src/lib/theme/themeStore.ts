import { THEME_STORAGE_KEY } from '@/lib/theme/themeInitScript';

/*
 * Client-side theme state (spec 5.5): an explicit choice lives in localStorage and on
 * `<html data-theme>`; no choice means the system preference. Shaped for useSyncExternalStore.
 */

export type ThemeChoice = 'light' | 'dark';

/** Fired on window after this document changes the theme. */
export const THEME_CHANGE_EVENT = 'sefid:theme-change';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Effective theme now: the attribute when set, else the system preference. */
export function isDarkNow(): boolean {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/** Server render: unknown, reported as light; the client snapshot follows after hydration. */
export const isDarkOnServer = (): boolean => false;

/** Re-applies the stored choice (dev Strict Mode can reset `<html>` attributes, ND-flash). */
export function applyStoredTheme(): void {
  const stored = readStored();
  if (stored !== null && document.documentElement.dataset.theme !== stored) {
    document.documentElement.dataset.theme = stored;
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

/** Sets an explicit theme, stores it when storage is available, and notifies subscribers. */
export function setTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Subscribes to system changes, this document's changes and other tabs' choices. */
export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const value = event.newValue;
    if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
    else delete document.documentElement.dataset.theme;
    onChange();
  };
  media.addEventListener('change', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
