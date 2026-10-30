// Creates the e2e accounts (two admins, one editor) with fresh random passwords, removes their
// TOTP enrollment, and writes the passwords to .data/e2e-users.json (gitignored, mode 0600) for
// the e2e specs. No seeder creates users (spec-data section 2), and the first-user page is
// blocked unless ALLOW_FIRST_USER=true. Every e2e run starts with unenrolled accounts, so the
// MFA spec always walks through enrollment.
//
// Runs only against an e2e database (its name or file name contains "e2e"), after migrate and
// seed. Playwright's global setup (tests/setup/e2eGlobal.ts) runs it before every e2e run:
//   node scripts/payload.mjs run tests/setup/e2eUsers.ts
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import config from '@payload-config';
import { getPayload } from 'payload';

import { E2E_TOTP_FILE, E2E_USERS_FILE, type E2eAccounts } from '../helpers/users';

function assertE2eDatabase(url = ''): void {
  let name = '';
  try {
    const parsed = new URL(url);
    name = parsed.protocol === 'file:' ? path.basename(url.slice('file:'.length)) : parsed.pathname;
  } catch {
    name = '';
  }
  if (!/e2e/i.test(name)) {
    throw new Error(
      'tests/setup/e2eUsers.ts: DATABASE_URL does not name an e2e database (e.g. file:./.data/e2e.db or .../sefid_e2e). Refusing to create accounts.',
    );
  }
}

assertE2eDatabase(process.env.DATABASE_URL);

const payload = await getPayload({ config });
const accounts: E2eAccounts = {
  admin: { email: 'e2e-admin@sefid.test', password: randomBytes(32).toString('base64url') },
  editor: { email: 'e2e-editor@sefid.test', password: randomBytes(32).toString('base64url') },
  guide: { email: 'e2e-guide@sefid.test', password: randomBytes(32).toString('base64url') },
};
const names = { admin: 'مدیر آزمون', editor: 'ویراستار آزمون', guide: 'مدیر راهنما' } as const;
const roles = { admin: 'admin', editor: 'editor', guide: 'admin' } as const;
const context = { skipAudit: true, skipRevalidate: true };

// Admin first: the first account of an empty database is always an admin.
for (const key of ['admin', 'editor', 'guide'] as const) {
  const { email, password } = accounts[key];
  const role = roles[key];
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  });
  const existing = found.docs[0];
  if (existing) {
    await payload.update({
      collection: 'users',
      id: existing.id,
      // overrideAccess (Local API default) also passes the plugin's read-only totpSecret field.
      data: { password, role, totpSecret: null },
      context,
    });
  } else {
    await payload.create({
      collection: 'users',
      data: { email, password, name: names[key], role },
      context,
    });
  }
}

const file = path.resolve(process.cwd(), E2E_USERS_FILE);
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 });
chmodSync(file, 0o600);
// TOTP secrets of the previous run belong to enrollments removed above.
rmSync(path.resolve(process.cwd(), E2E_TOTP_FILE), { force: true });
payload.logger.info(
  `e2e accounts ready: ${Object.values(accounts)
    .map((a) => a.email)
    .join(', ')}`,
);
// Close the database pool, or `payload run` keeps the process alive on Postgres.
await payload.destroy();
