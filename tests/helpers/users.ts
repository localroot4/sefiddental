// Credentials of the e2e accounts, written by tests/setup/e2eUsers.ts for the current e2e
// database. Passwords are random per database and never committed.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

export const E2E_USERS_FILE = '.data/e2e-users.json';
/** TOTP secrets of accounts the MFA spec enrolled in this run, by email (gitignored, 0600). */
export const E2E_TOTP_FILE = '.data/e2e-totp.json';

const account = z.object({ email: z.email(), password: z.string().min(12) });
// guide: an admin only tests/e2e/admin-guide.spec.ts signs in with, so its TOTP enrollment never
// races admin.spec.ts for the other two.
const accountsSchema = z.object({ admin: account, editor: account, guide: account });

export type E2eAccount = z.infer<typeof account>;
export type E2eAccounts = z.infer<typeof accountsSchema>;

export function e2eAccounts(): E2eAccounts {
  const file = path.resolve(process.cwd(), E2E_USERS_FILE);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `${E2E_USERS_FILE} is missing. Playwright's global setup writes it (tests/setup/e2eGlobal.ts); by hand: node scripts/payload.mjs run tests/setup/e2eUsers.ts with DATABASE_URL of the e2e database.`,
    );
  }
  return accountsSchema.parse(JSON.parse(raw));
}
