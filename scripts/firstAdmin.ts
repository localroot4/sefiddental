import type { Payload } from 'payload';

/** The account's display name until the admin changes it in the panel (Users requires one). */
const FIRST_ADMIN_NAME = 'مدیر سایت';

export type FirstAdminResult = 'created' | 'skipped: users exist';

/**
 * The first admin of an empty users collection, for a server where the first-user screen stays
 * off (ALLOW_FIRST_USER=false). Any existing account makes it a no-op, so a second run changes
 * nothing. The Users rules apply: the password policy, the required name, the audit entry.
 * Count and create are two queries; the workflow "Server" runs one action at a time.
 */
export async function createFirstAdmin(
  payload: Payload,
  rawEmail: string,
  password: string,
): Promise<FirstAdminResult> {
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true });
  if (totalDocs > 0) return 'skipped: users exist';
  await payload.create({
    collection: 'users',
    data: { email: rawEmail.trim().toLowerCase(), password, name: FIRST_ADMIN_NAME, role: 'admin' },
  });
  return 'created';
}
