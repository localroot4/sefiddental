// Global setup of the e2e run (Playwright runs it after the web servers are up): resets the e2e
// accounts on the database the servers use, so the MFA spec always starts unenrolled and no
// password is ever committed.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { E2E_USERS_FILE } from '../helpers/users';

/** The migrated e2e database (freeze 7.2): E2E_DATABASE_URL in CI, else `npm run db:e2e`'s file. */
export function e2eDatabaseUrl(): string {
  return process.env.E2E_DATABASE_URL ?? 'file:./.data/e2e.db';
}

const ATTEMPTS = 2;

export default function globalSetup(): void {
  const started = Date.now();
  const file = path.resolve(process.cwd(), E2E_USERS_FILE);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = spawnSync('npx', ['payload', 'run', 'tests/setup/e2eUsers.ts'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), DB_PUSH: 'false' },
    });
    if (result.status !== 0) {
      throw new Error(`e2e global setup: tests/setup/e2eUsers.ts exited with ${result.status}.`);
    }
    // `payload run` can exit 0 before the script ran (ci.yml guards the seeder the same way):
    // success means the script rewrote the accounts file during this setup.
    if (existsSync(file) && statSync(file).mtimeMs >= started) return;
    console.warn(
      `e2e global setup: attempt ${attempt} of ${ATTEMPTS} exited 0 without writing ${E2E_USERS_FILE}.`,
    );
  }
  throw new Error(
    `e2e global setup: tests/setup/e2eUsers.ts exited 0 without writing ${E2E_USERS_FILE} ` +
      '(payload run exited early); rerun the e2e suite.',
  );
}
