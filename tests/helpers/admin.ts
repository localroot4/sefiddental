// Admin sign-in for e2e, including the TOTP step of payload-totp (freeze decision 9). With
// `forceSetup: true` the first sign-in of an account goes to /admin/setup-totp (enrollment);
// every later sign-in goes to /admin/verify-totp. Codes come from otpauth with the plugin's
// parameters, so the spec never reads a phone.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { Secret, TOTP } from 'otpauth';
import { z } from 'zod';

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

/** Types the code into the first box of the plugin's six-box input; the form submits itself. */
async function enterCode(page: Page, secret: string): Promise<void> {
  await page.locator('form input[maxlength="1"]').first().click();
  await page.keyboard.type(totpCode(secret));
}

export type AdminSignIn = 'enrolled' | 'verified';

/**
 * Signs in through /admin/login and completes the TOTP step. Returns 'enrolled' when this
 * sign-in set TOTP up, 'verified' when the account already had it. Ends on the dashboard.
 */
export async function signInToAdmin(page: Page, account: E2eAccount): Promise<AdminSignIn> {
  await page.goto('/admin/login');
  await page.locator('#field-email').fill(account.email);
  await page.locator('#field-password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => /^\/admin\/(setup|verify)-totp$/.test(url.pathname));

  let step: AdminSignIn;
  if (new URL(page.url()).pathname === '/admin/setup-totp') {
    const secret = await page.locator('input[name="secret"]').inputValue();
    saveSecret(account.email, secret);
    await enterCode(page, secret);
    step = 'enrolled';
  } else {
    const secret = readSecrets()[account.email];
    if (!secret) {
      throw new Error(
        `${account.email} has TOTP, but ${E2E_TOTP_FILE} has no secret for it. Reset the e2e accounts: npx payload run tests/setup/e2eUsers.ts`,
      );
    }
    await enterCode(page, secret);
    step = 'verified';
  }
  await page.waitForURL((url) => /^\/admin\/?$/.test(url.pathname));
  return step;
}
