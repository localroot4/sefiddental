import { randomBytes } from 'node:crypto';

import type { Payload } from 'payload';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createFirstAdmin } from '../../scripts/firstAdmin';
import { getTestPayload, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

describe('first admin of the server workflow', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('FA1 an empty users collection gets an admin who can sign in', async () => {
    // Tests never assume empty tables: only the emptiness check sees zero accounts. Real ones
    // exist, so the admin role comes from createFirstAdmin, not from the firstUserIsAdmin hook.
    await staffUsers(payload);
    vi.spyOn(payload, 'count').mockResolvedValueOnce({ totalDocs: 0 });
    const email = `first-${unique()}@sefid.test`;
    const password = randomBytes(18).toString('base64url');
    expect(await createFirstAdmin(payload, ` ${email.toUpperCase()} `, password)).toBe('created');
    const login = await payload.login({ collection: 'users', data: { email, password } });
    expect(login.user?.role).toBe('admin');
  });

  it('FA2 an existing account leaves the users collection unchanged', async () => {
    await staffUsers(payload);
    const before = await payload.count({ collection: 'users' });
    const email = `second-${unique()}@sefid.test`;
    const result = await createFirstAdmin(payload, email, randomBytes(18).toString('base64url'));
    expect(result).toBe('skipped: users exist');
    expect(await payload.count({ collection: 'users' })).toEqual(before);
  });

  it('FA3 a password against the policy is refused', async () => {
    vi.spyOn(payload, 'count').mockResolvedValueOnce({ totalDocs: 0 });
    await expect(
      createFirstAdmin(payload, `weak-${unique()}@sefid.test`, 'short'),
    ).rejects.toThrow();
  });
});
