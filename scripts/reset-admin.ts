// `npm run reset-admin -- <email>` (= `payload run scripts/reset-admin.ts <email>`) on a host with
// the production DATABASE_URL: prints a new password once. See scripts/resetAccount.ts.
// With ADMIN_PASSWORD set (the workflow "Server", action reset-admin) that is the new password,
// and nothing prints it: the output is a run log.
import config from '@payload-config';
import { getPayload } from 'payload';

import { resetAccount } from './resetAccount';

const arg = process.argv.slice(2).find((value) => !value.startsWith('-'));
if (!arg)
  throw new Error('reset-admin: give the account e-mail, e.g. npm run reset-admin -- a@b.ir');
const email = arg.trim().toLowerCase();
const given = process.env.ADMIN_PASSWORD || undefined;

const payload = await getPayload({ config });
let password: string;
try {
  password = await resetAccount(payload, email, given);
} catch (err) {
  // Field messages only: a failed database write prints its parameters (the password hash).
  const fields = (err as { data?: { errors?: { message: string }[] } }).data?.errors;
  const reason = fields?.map((e) => e.message).join('; ') ?? String(err).split('\n')[0];
  process.stderr.write(`reset-admin: ${email} failed: ${reason}\n`);
  process.exit(1);
}
process.stdout.write(
  given
    ? `reset-admin: ${email} reset\nSign in with the password of ADMIN_PASSWORD, change it, and set up TOTP again.\n`
    : // stdout of the operator's shell, not the server log.
      `reset-admin: new password for ${email}: ${password}\n` +
        'Sign in with it, change it, and set up TOTP again.\n',
);
process.exit(0);
