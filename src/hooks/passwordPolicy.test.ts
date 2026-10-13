import type { PayloadRequest } from 'payload';
import { ValidationError } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { enforcePasswordPolicy, passwordProblem } from './passwordPolicy';

const STORED = { id: 7, email: 'reception.sefid@example.com' };
const GOOD = 'a long and fine passphrase';
const HAS_LOCAL = 'my reception.sefid secret';

function fakeReq() {
  const payload = {
    findByID: vi.fn(async () => STORED),
    find: vi.fn(async () => ({ docs: [STORED] })),
    db: { findOne: vi.fn(async () => STORED) },
  };
  return { req: { payload } as unknown as PayloadRequest, payload };
}

type HookArg = Parameters<typeof enforcePasswordPolicy>[0];

function run(
  operation: string,
  args: Record<string, unknown>,
  req: PayloadRequest,
  overrideAccess = false,
) {
  return enforcePasswordPolicy({
    args,
    collection: { slug: 'users' },
    context: {},
    operation,
    overrideAccess,
    req,
  } as unknown as HookArg);
}

describe('password policy', () => {
  it('PP1 length and email local part', () => {
    expect(passwordProblem('short')).toMatch(/۱۲/);
    expect(passwordProblem(HAS_LOCAL, STORED.email)).not.toBeNull();
    expect(passwordProblem(GOOD, STORED.email)).toBeNull();
  });

  it('PP2 create checks the incoming email without a lookup', async () => {
    const { req, payload } = fakeReq();
    await expect(
      run('create', { data: { email: STORED.email, password: HAS_LOCAL } }, req),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      run('create', { data: { email: STORED.email, password: GOOD } }, req),
    ).resolves.toBeDefined();
    expect(payload.findByID).not.toHaveBeenCalled();
  });

  it('PP3 a password-only update by id checks the stored email', async () => {
    const { req, payload } = fakeReq();
    await expect(
      run('update', { id: 7, data: { password: HAS_LOCAL } }, req),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, overrideAccess: false, req }),
    );
    await expect(run('update', { id: 7, data: { password: GOOD } }, req)).resolves.toBeDefined();
    await run('update', { id: 7, data: { password: GOOD } }, req, true);
    expect(payload.findByID).toHaveBeenLastCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    );
  });

  it('PP7 a caller who cannot read the account learns nothing about its email', async () => {
    const { req, payload } = fakeReq();
    payload.findByID.mockResolvedValue(null as never);
    payload.find.mockResolvedValue({ docs: [] } as never);
    await expect(
      run('update', { id: 7, data: { password: HAS_LOCAL } }, req),
    ).resolves.toBeDefined();
    await expect(
      run(
        'update',
        { where: { email: { like: 'reception' } }, data: { password: HAS_LOCAL } },
        req,
      ),
    ).resolves.toBeDefined();
  });

  it('PP4 a bulk password update checks every matched account', async () => {
    const { req, payload } = fakeReq();
    const where = { role: { equals: 'editor' } };
    await expect(
      run('update', { where, data: { password: HAS_LOCAL } }, req),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where, pagination: false, overrideAccess: false }),
    );
  });

  it('PP5 resetPassword finds the account by its reset token', async () => {
    const { req, payload } = fakeReq();
    await expect(
      run('resetPassword', { data: { token: 'abc', password: HAS_LOCAL } }, req),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(payload.db.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { resetPasswordToken: { equals: 'abc' } } }),
    );
  });

  it('PP6 no password, other operations and short passwords need no lookup', async () => {
    const { req, payload } = fakeReq();
    await run('update', { id: 7, data: { name: 'x' } }, req);
    await run('login', { data: { email: STORED.email, password: HAS_LOCAL } }, req);
    await expect(run('update', { id: 7, data: { password: 'short' } }, req)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(payload.findByID).not.toHaveBeenCalled();
  });
});
