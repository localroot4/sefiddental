// Admin sign-in for e2e, including the TOTP step of payload-totp (freeze decision 9). With
// `forceSetup: true` the first sign-in of an account goes to <ADMIN_ROUTE>/setup-totp
// (enrollment); every later sign-in goes to <ADMIN_ROUTE>/verify-totp. Codes come from otpauth with the plugin's
// parameters, so the spec never reads a phone.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { Secret, TOTP } from 'otpauth';
import { z } from 'zod';

import { ADMIN_ROUTE } from '@/lib/paths';

import { E2E_TOTP_FILE, type E2eAccount } from './users';

/** The plugin's defaults (src/payload.config.ts sets only the issuer). */
export function totpCode(secretBase32: string, timestamp = Date.now()): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secretBase32),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  return totp.generate({ timestamp });
}

const secretsSchema = z.record(z.string(), z.string().regex(/^[A-Z2-7]+=*$/));

function totpFile(): string {
  return path.resolve(process.cwd(), E2E_TOTP_FILE);
}

function readSecrets(): Record<string, string> {
  try {
    return secretsSchema.parse(JSON.parse(readFileSync(totpFile(), 'utf8')));
  } catch {
    return {};
  }
}

function saveSecret(email: string, secret: string): void {
  const file = totpFile();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...readSecrets(), [email]: secret }, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(file, 0o600);
}

/** The plugin's Persian label of the setup page's manual-entry link (payload-totp i18n/fa.js). */
const MANUAL_ENTRY = 'افزودن کد به صورت دستی';

/** The secret the setup page shows for manual entry: the one its QR code holds. */
export async function setupSecret(page: Page): Promise<string> {
  await page.getByText(MANUAL_ENTRY, { exact: true }).click();
  return (await page.locator('code').first().innerText()).replace(/\s/g, '');
}

/** Types the code into the first box of the six-box input; the form submits itself. */
async function enterCode(page: Page, secret: string): Promise<void> {
  await page.locator('form input[maxlength="1"]').first().click();
  await page.keyboard.type(totpCode(secret));
}

export type AdminSignIn = 'enrolled' | 'verified';

/**
 * Signs in through <ADMIN_ROUTE>/login and completes the TOTP step. Returns 'enrolled' when this
 * sign-in set TOTP up, 'verified' when the account already had it. Ends on the dashboard.
 */
export async function signInToAdmin(page: Page, account: E2eAccount): Promise<AdminSignIn> {
  await page.goto(`${ADMIN_ROUTE}/login`);
  await page.locator('#field-email').fill(account.email);
  await page.locator('#field-password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) =>
    [`${ADMIN_ROUTE}/setup-totp`, `${ADMIN_ROUTE}/verify-totp`].includes(url.pathname),
  );

  let step: AdminSignIn;
  if (new URL(page.url()).pathname === `${ADMIN_ROUTE}/setup-totp`) {
    const secret = await setupSecret(page);
    saveSecret(account.email, secret);
    await enterCode(page, secret);
    step = 'enrolled';
  } else {
    const secret = readSecrets()[account.email];
    if (!secret) {
      throw new Error(
        `${account.email} has TOTP, but ${E2E_TOTP_FILE} has no secret for it. Reset the e2e accounts: node scripts/payload.mjs run tests/setup/e2eUsers.ts`,
      );
    }
    await enterCode(page, secret);
    step = 'verified';
  }
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === ADMIN_ROUTE);
  return step;
}
