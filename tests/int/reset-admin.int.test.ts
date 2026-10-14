import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { resetAccount } from '../../scripts/resetAccount';
import { getTestPayload, staffUsers } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

describe('account recovery without SMTP (SEC-AUTH-3)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('RA1 a locked, TOTP-enrolled admin gets a new password, no TOTP secret and no lock', async () => {
    const { admin } = await staffUsers(payload);
    await payload.db.updateOne({
      collection: 'users',
      id: admin.id,
      data: {
        totpSecret: 'JBSWY3DPEHPK3PXP',
        loginAttempts: 5,
        lockUntil: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    const password = await resetAccount(payload, ` ${admin.email.toUpperCase()} `);
    const login = await payload.login({
      collection: 'users',
      data: { email: admin.email, password },
    });
    expect(login.user?.id).toBe(admin.id);
    const stored = await payload.db.findOne<{ id: number | string; totpSecret?: string | null }>({
      collection: 'users',
      where: { id: { equals: admin.id } },
    });
    expect(stored?.totpSecret ?? null).toBeNull();
    await expect(resetAccount(payload, 'nobody@sefid.test')).rejects.toThrow(/no account/);
  });
});
