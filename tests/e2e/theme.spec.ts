// Theme without a flash: the head script applies a stored choice before the first frame, and
// without one the page follows the system preference (each project emulates light or dark).
import { expect, test, type Page } from '@playwright/test';

import { t } from '@/i18n/fa';

import { skipIntro } from '../helpers/intro';
import { effectiveTheme, projectTheme, setThemeChoice, type Theme } from '../helpers/theme';

// --color-surface of design/tokens.css per theme (the layout's theme-color uses the same pair).
const SURFACE: Record<Theme, string> = { light: '#f7f8f7', dark: '#071a2b' };

interface FirstFrame {
  dataTheme: string | null;
  surface: string;
}

/** Records html[data-theme] and the surface token in the first animation frame of each load. */
async function recordFirstFrame(page: Page): Promise<() => Promise<FirstFrame>> {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement;
      const frame = {
        dataTheme: root.dataset.theme ?? null,
        surface: getComputedStyle(root).getPropertyValue('--color-surface').trim().toLowerCase(),
      };
      Reflect.set(window, '__sefidFirstFrame', frame);
    });
  });
  return async () => {
    const handle = await page.waitForFunction(() => Reflect.get(window, '__sefidFirstFrame'));
    return (await handle.jsonValue()) as FirstFrame;
  };
}

const opposite = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

test.beforeEach(({ page }) => skipIntro(page));

test('T-TH1 without a stored choice the first frame follows the system preference', async ({
  page,
}, testInfo) => {
  const system = projectTheme(testInfo);
  const firstFrame = await recordFirstFrame(page);
  await page.goto('/');
  expect(await firstFrame()).toEqual({ dataTheme: null, surface: SURFACE[system] });
  expect(await effectiveTheme(page)).toBe(system);
});

test('T-TH2 a stored choice against the system preference applies before the first frame', async ({
  page,
}, testInfo) => {
  const chosen = opposite(projectTheme(testInfo));
  await setThemeChoice(page, chosen);
  const firstFrame = await recordFirstFrame(page);
  await page.goto('/qa/not-found');
  expect(await firstFrame()).toEqual({ dataTheme: chosen, surface: SURFACE[chosen] });
  await page.waitForLoadState('load');
  expect(await effectiveTheme(page)).toBe(chosen);
});

test('T-TH3 the toggle switches the theme and the choice survives a reload without a flash', async ({
  page,
}, testInfo) => {
  const system = projectTheme(testInfo);
  const firstFrame = await recordFirstFrame(page);
  await page.goto('/qa/not-found');
  // Below 1024 px the toggle lives in the drawer.
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole('button', { name: t('nav.menuOpen') }).click();
  const toggle = page.getByRole('button', { name: t('theme.toggle') });
  await expect(toggle).toHaveAttribute('aria-pressed', String(system === 'dark'));
  await toggle.click();
  const chosen = opposite(system);
  await expect(page.locator('html')).toHaveAttribute('data-theme', chosen);
  await expect(toggle).toHaveAttribute('aria-pressed', String(chosen === 'dark'));
  await page.reload();
  expect(await firstFrame()).toEqual({ dataTheme: chosen, surface: SURFACE[chosen] });
});
