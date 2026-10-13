// Smoke checks on the standalone artifact: the public layout and the admin both render in
// Persian, right to left. Admin login needs one account (tests/setup/e2eUsers.ts): without
// any user, Payload sends /admin/login to the first-user page, which the proxy answers with 404.
import { expect, test } from '@playwright/test';

test('T-SM1 home renders with lang fa and dir rtl', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('T-SM2 admin login page renders in Persian, right to left', async ({ page }) => {
  const response = await page.goto('/admin/login');
  expect(response?.status()).toBe(200);
  // The login form renders on the client (the server HTML of the view has an empty body).
  await expect(page.locator('#field-email')).toBeVisible();
  await expect(page.locator('#field-password')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  // Payload writes dir="RTL" in capitals (freeze decision 44): compare case-insensitively.
  await expect(page.locator('html')).toHaveAttribute('dir', /^rtl$/i);
});
