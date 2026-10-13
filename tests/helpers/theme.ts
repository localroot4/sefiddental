// Theme helpers. The site follows the system preference unless the reader chose a theme with
// the toggle (localStorage, applied as html[data-theme] before first paint).
import type { BrowserContext, Page, TestInfo } from '@playwright/test';

import { THEME_STORAGE_KEY } from '@/lib/theme/themeInitScript';

export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

/** The theme a project emulates through its `colorScheme`; light when the project sets none. */
export function projectTheme(testInfo: TestInfo): Theme {
  return testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light';
}

/**
 * Stores a theme choice before any page script runs, as the toggle would have done on an
 * earlier visit. 'system' removes the stored choice.
 */
export async function setThemeChoice(
  target: BrowserContext | Page,
  choice: ThemeChoice,
): Promise<void> {
  await target.addInitScript(
    ([key, value]) => {
      try {
        if (value === 'system') localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Storage blocked: the page follows the system preference, which the test can assert.
      }
    },
    [THEME_STORAGE_KEY, choice] as const,
  );
}

/** The theme the page shows now: html[data-theme] when set, else the system preference. */
export async function effectiveTheme(page: Page): Promise<Theme> {
  return page.evaluate(() => {
    const chosen = document.documentElement.dataset.theme;
    if (chosen === 'dark' || chosen === 'light') return chosen;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
}
