import { randomBytes } from 'node:crypto';

import type { Payload } from 'payload';

import { passwordProblem } from '@/hooks/passwordPolicy';

/**
 * Recovery for a locked-out account when no SMTP server is set (SEC-AUTH-3): Payload's console
 * mail adapter logs only the recipient and subject, never the reset link. Sets a new random
 * password, removes the TOTP secret (the next sign-in enrolls again) and lifts the sign-in lock.
 * Returns the new password; the caller shows it once to the operator, never in a log.
 */
export async function resetAccount(payload: Payload, rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  });
  const user = docs[0];
  if (!user)
    throw new Error(`reset-admin: no account has the e-mail "${email}". Check the address.`);
  let password = randomBytes(18).toString('base64url');
  while (passwordProblem(password, email)) password = randomBytes(18).toString('base64url');
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password, totpSecret: null } as never,
    depth: 0,
  });
  await payload.unlock({ collection: 'users', data: { email } as never, overrideAccess: true });
  return password;
}
