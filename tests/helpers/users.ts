// Credentials of the e2e accounts, written by tests/setup/e2eUsers.ts for the current e2e
// database. Passwords are random per database and never committed.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

export const E2E_USERS_FILE = '.data/e2e-users.json';

const account = z.object({ email: z.email(), password: z.string().min(12) });
const accountsSchema = z.object({ admin: account, editor: account });

export type E2eAccount = z.infer<typeof account>;
export type E2eAccounts = z.infer<typeof accountsSchema>;

export function e2eAccounts(): E2eAccounts {
  const file = path.resolve(process.cwd(), E2E_USERS_FILE);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `${E2E_USERS_FILE} is missing. Create the e2e accounts first: npx payload run tests/setup/e2eUsers.ts (with DATABASE_URL of the e2e database).`,
    );
  }
  return accountsSchema.parse(JSON.parse(raw));
}
