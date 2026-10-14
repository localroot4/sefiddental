import type { PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { editorialAccess, taxonomyAccess } from './presets';
import { hasRole, hiddenForEditors, isAdmin, isStaff, trashOnlyForEditors } from './roles';
import { asJobRunner, totpUnlessServerUser } from './totp';

const admin = { id: 1, role: 'admin', collection: 'users' };
const editor = { id: 2, role: 'editor', collection: 'users' };

/** A request whose payload carries the payload-totp options the wrapper reads. */
function req(
  user: object | null,
  pluginOptions: object = { collection: 'users', forceSetup: true },
) {
  return {
    user,
    payload: { config: { custom: { totp: { pluginOptions } } } },
  } as unknown as PayloadRequest;
}

describe('roles (spec-data 5.1)', () => {
  it('R1 hasRole, isAdmin, isStaff', () => {
    expect(hasRole(admin, 'admin')).toBe(true);
    expect(hasRole(editor, 'admin')).toBe(false);
    expect(hasRole(null, 'admin', 'editor')).toBe(false);
    expect(isAdmin({ req: req(admin) })).toBe(true);
    expect(isStaff({ req: req(editor) })).toBe(true);
    expect(isStaff({ req: req(null) })).toBe(false);
  });

  it('R2 editors only trash; admins delete permanently (P22)', () => {
    const trash = { deletedAt: '2026-10-13T00:00:00.000Z' };
    expect(trashOnlyForEditors({ req: req(editor), data: trash })).toBe(true);
    expect(trashOnlyForEditors({ req: req(editor), data: undefined })).toBe(false);
    expect(trashOnlyForEditors({ req: req(admin), data: undefined })).toBe(true);
    expect(trashOnlyForEditors({ req: req(null), data: trash })).toBe(false);
  });

  it('R3 only admins see hidden entities', () => {
    expect(hiddenForEditors({ user: editor })).toBe(true);
    expect(hiddenForEditors({ user: admin })).toBe(false);
    expect(hiddenForEditors({ user: null })).toBe(true);
  });

  it('R4 presets: taxonomy is admin-written, editorial staff-written, scheduled ones opt out of the update wrapper', () => {
    const taxonomy = taxonomyAccess();
    expect(taxonomy.access.update?.({ req: req(editor) } as never)).toBe(false);
    expect(taxonomy.access.read?.({ req: req(editor) } as never)).toBe(true);
    expect(taxonomy.custom).toBeUndefined();
    const editorial = editorialAccess({ scheduled: true });
    expect(editorial.custom).toEqual({ totp: { disableAccessWrapper: { update: true } } });
    expect(
      taxonomyAccess({ editorsWrite: true }).access.create?.({ req: req(editor) } as never),
    ).toBe(true);
  });
});

describe('totpUnlessServerUser (PAY 12.4, freeze decision 27)', () => {
  const inner = vi.fn(() => true);

  it('TS1 a user without an auth strategy skips the TOTP check only inside the job runner', async () => {
    const enrolled = { ...editor, hasTotp: true };
    expect(await asJobRunner(async () => totpUnlessServerUser(inner)({ req: req(enrolled) }))).toBe(
      true,
    );
    expect(inner).toHaveBeenCalledTimes(1);
    // SEC-AUTH-1: outside it a missing strategy proves nothing.
    expect(await totpUnlessServerUser(inner)({ req: req(enrolled) })).toBe(false);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('TS2 an HTTP session of an enrolled user that has not entered a code is refused', async () => {
    inner.mockClear();
    const session = { ...editor, hasTotp: true, _strategy: 'local-jwt' };
    expect(await totpUnlessServerUser(inner)({ req: req(session) })).toBe(false);
    expect(inner).not.toHaveBeenCalled();
  });

  it('TS3 a session that passed the code reaches the inner access; anonymous never does', async () => {
    inner.mockClear();
    expect(await totpUnlessServerUser(inner)({ req: req({ ...editor, _strategy: 'totp' }) })).toBe(
      true,
    );
    expect(await totpUnlessServerUser(inner)({ req: req(null) })).toBe(false);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
