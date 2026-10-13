// Global setup of the e2e run (Playwright runs it after the web servers are up): resets the e2e
// accounts on the database the servers use, so the MFA spec always starts unenrolled and no
// password is ever committed.
import { spawnSync } from 'node:child_process';

/** The migrated e2e database (freeze 7.2): E2E_DATABASE_URL in CI, else `npm run db:e2e`'s file. */
export function e2eDatabaseUrl(): string {
  return process.env.E2E_DATABASE_URL ?? 'file:./.data/e2e.db';
}

export default function globalSetup(): void {
  const result = spawnSync('npx', ['payload', 'run', 'tests/setup/e2eUsers.ts'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), DB_PUSH: 'false' },
  });
  if (result.status !== 0) {
    throw new Error(`e2e global setup: tests/setup/e2eUsers.ts exited with ${result.status}.`);
  }
}
