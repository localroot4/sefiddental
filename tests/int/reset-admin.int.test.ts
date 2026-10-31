import { randomBytes } from 'node:crypto';

import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/(payload)/api/[...slug]/route';

import { resetAccount } from '../../scripts/resetAccount';
import { getTestPayload, staffUsers, unique } from './helpers';

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

  it('RA2 a given password becomes the new one; a password against the policy is refused', async () => {
    const { admin } = await staffUsers(payload);
    await payload.db.updateOne({
      collection: 'users',
      id: admin.id,
      data: { totpSecret: 'JBSWY3DPEHPK3PXP' },
    });
    const given = 'Given-password-for-the-workflow-reset';
    expect(await resetAccount(payload, admin.email, given)).toBe(given);
    const login = await payload.login({
      collection: 'users',
      data: { email: admin.email, password: given },
    });
    expect(login.user?.id).toBe(admin.id);
    await expect(resetAccount(payload, admin.email, 'short')).rejects.toThrow(/refused/);
    // The refused password did not replace the given one.
    await expect(
      payload.login({ collection: 'users', data: { email: admin.email, password: given } }),
    ).resolves.toBeTruthy();
  });

  it('RA3 the reset ends every session: the old cookie no longer authenticates', async () => {
    // src/admin/totp/server.ts derives the setup secret from the session: a reset that kept
    // the session would let it see the secret again (with updatedAt, also changed by the reset).
    const email = `reset-${unique()}@sefid.test`;
    const password = randomBytes(18).toString('base64url');
    const user = await payload.create({
      collection: 'users',
      data: { email, password, name: 'آزمون بازنشانی', role: 'editor' },
      context: { skipAudit: true },
    });
    const login = await POST(
      new Request('http://localhost/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
      { params: Promise.resolve({ slug: ['users', 'login'] }) } as never,
    );
    expect(login.status).toBe(200);
    const cookie = login.headers
      .getSetCookie()
      .find((c) => c.startsWith('payload-token='))
      ?.split(';')[0];
    expect(cookie).toBeDefined();
    // Payload's own JWT strategy (payload.auth would run payload-totp's first, which needs a
    // Next.js request scope for its cookie).
    const jwt = payload.authStrategies.find((strategy) => strategy.name === 'local-jwt');
    const session = async () =>
      (
        await jwt!.authenticate({
          // As the admin's own requests: Payload checks the fetch site of a cookie (csrf).
          headers: new Headers({ cookie: cookie ?? '', 'sec-fetch-site': 'same-origin' }),
          payload,
          canSetHeaders: false,
          isGraphQL: false,
        })
      ).user;
    expect((await session())?.id).toBe(user.id);

    await resetAccount(payload, email);
    const stored = await payload.db.findOne<{ id: number; sessions?: unknown[] | null }>({
      collection: 'users',
      where: { id: { equals: user.id } },
    });
    expect(stored?.sessions ?? []).toEqual([]);
    expect(await session()).toBeNull();
  });
});
