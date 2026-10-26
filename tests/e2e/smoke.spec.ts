// Smoke checks on the standalone artifact: the public layout and the admin both render in
// Persian, right to left, and the skip link works. Admin sign-in is in admin.spec.ts.
import { expect, test } from '@playwright/test';

import { t } from '@/i18n/fa';
import { ADMIN_ROUTE } from '@/lib/paths';

import { watchConsoleErrors } from '../helpers/console';

test('T-SM1 home renders with lang fa and dir rtl, without console errors', async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page);
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.waitForLoadState('load');
  expect(consoleErrors()).toEqual([]);
});

test('T-SM2 the admin route shows the sign-in, in Persian, right to left', async ({ page }) => {
  const response = await page.goto(ADMIN_ROUTE);
  expect(response?.status()).toBe(200);
  // Payload sends a signed-out visitor on to the sign-in view from the streamed page.
  await expect(page).toHaveURL((url) => url.pathname === `${ADMIN_ROUTE}/login`);
  // The login form renders on the client (the server HTML of the view has an empty body).
  await expect(page.locator('#field-email')).toBeVisible();
  await expect(page.locator('#field-password')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  // Payload writes dir="RTL" in capitals (freeze decision 44): compare case-insensitively.
  await expect(page.locator('html')).toHaveAttribute('dir', /^rtl$/i);
});

test('T-SM3 the skip link is the first tab stop, shows on focus and moves focus to main', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: t('skip.toMain') });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});
