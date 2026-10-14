// `npm run reset-admin -- <email>` (= `payload run scripts/reset-admin.ts <email>`) on a host with
// the production DATABASE_URL: prints a new password once. See scripts/resetAccount.ts.
import config from '@payload-config';
import { getPayload } from 'payload';

import { resetAccount } from './resetAccount';

const email = process.argv.slice(2).find((value) => !value.startsWith('-'));
if (!email)
  throw new Error('reset-admin: give the account e-mail, e.g. npm run reset-admin -- a@b.ir');

const payload = await getPayload({ config });
const password = await resetAccount(payload, email);
// stdout of the operator's shell, not the server log.
process.stdout.write(
  `reset-admin: new password for ${email.trim().toLowerCase()}: ${password}\n` +
    'Sign in with it, change it, and set up TOTP again.\n',
);
process.exit(0);
