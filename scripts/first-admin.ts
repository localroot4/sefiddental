// `npm run first-admin` (= `payload run scripts/first-admin.ts`) with ADMIN_EMAIL, ADMIN_PASSWORD
// and the production DATABASE_URL and PAYLOAD_SECRET: creates the first admin of an empty
// database (scripts/firstAdmin.ts). The workflow "Server" runs it through an SSH tunnel.
// Prints the e-mail and the result, never the password.
import config from '@payload-config';
import { getPayload } from 'payload';

import { createFirstAdmin } from './firstAdmin';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
if (!email || !password) throw new Error('first-admin: set ADMIN_EMAIL and ADMIN_PASSWORD.');

const payload = await getPayload({ config });
try {
  const result = await createFirstAdmin(payload, email, password);
  process.stdout.write(`first-admin: ${email} ${result}\n`);
} catch (err) {
  // Field messages only: a failed database write prints its parameters (the password hash).
  const fields = (err as { data?: { errors?: { message: string }[] } }).data?.errors;
  const reason = fields?.map((e) => e.message).join('; ') ?? String(err).split('\n')[0];
  process.stderr.write(`first-admin: ${email} failed: ${reason}\n`);
  process.exit(1);
}
process.exit(0);
