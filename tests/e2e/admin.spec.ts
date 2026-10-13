// MFA acceptance (docs/prompts/03-foundation.md: "MFA enrollment works"): the first sign-in of
// an account must enroll TOTP, and every later sign-in asks for a code. Playwright's global
// setup resets the e2e accounts, so each run starts unenrolled.
import { expect, test } from '@playwright/test';

import { signInToAdmin } from '../helpers/admin';
import { e2eAccounts } from '../helpers/users';

test('T-AD1 first sign-in enrolls TOTP; the next sign-in verifies a code; the panel is Persian RTL', async ({
  page,
}, testInfo) => {
  // The admin account and its TOTP state are shared by every project: one project signs in.
  test.skip(testInfo.project.name !== 'desktop-light', 'shared account: desktop-light only');
  const { admin } = e2eAccounts();

  expect(await signInToAdmin(page, admin)).toBe('enrolled');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', /^rtl$/i);

  await page.context().clearCookies();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);

  expect(await signInToAdmin(page, admin)).toBe('verified');
});
