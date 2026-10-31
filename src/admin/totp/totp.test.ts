import { Secret, TOTP } from 'otpauth';
import type { Endpoint, PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { codeDigits, normalizeCode } from './code';
import { pendingTotpSecret, safeBackPath, withCodeFixes } from './server';

const SECRET = 'payload-secret-for-tests';
const user = {
  collection: 'users',
  id: 7,
  _sid: 'session-a',
  updatedAt: '2026-10-31T10:00:00.000Z',
};

describe('codeDigits (TOTP code input and endpoints)', () => {
  it('TT1 Persian and Arabic-Indic digits become ASCII', () => {
    expect(codeDigits('۱۲۳۴۵۶')).toBe('123456');
    expect(codeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(codeDigits('۰۹٠٩09')).toBe('090909');
  });

  it('TT2 spaces, dashes and letters are dropped, as in a code copied from 1Password', () => {
    expect(codeDigits(' 123 456 ')).toBe('123456');
    expect(codeDigits('123-456\n')).toBe('123456');
    expect(codeDigits('۱۲۳‌۴۵۶')).toBe('123456');
    expect(codeDigits('abc')).toBe('');
  });
});

describe('normalizeCode (the token the code endpoints check)', () => {
  it('TT12 digits become ASCII; whitespace, dashes and ZWNJ go; anything else stays', () => {
    expect(normalizeCode(' ۱۲۳ ۴۵۶\n')).toBe('123456');
    expect(normalizeCode('٤٥٦-١٢٣')).toBe('456123');
    expect(normalizeCode('۱۲۳\u200c۴۵۶')).toBe('123456');
    // Not a code: the plugin refuses it rather than a cleaned-up guess.
    expect(normalizeCode('12a456')).toBe('12a456');
    expect(normalizeCode('123.456')).toBe('123.456');
  });
});

describe('pendingTotpSecret', () => {
  it('TT3 the same user and session get the same secret: a reload keeps what was scanned', () => {
    const secret = pendingTotpSecret(SECRET, user);
    expect(secret).toMatch(/^[A-Z2-7]{52}$/);
    expect(pendingTotpSecret(SECRET, { ...user })).toBe(secret);
  });

  it('TT4 another session, user, collection, Payload secret or user write gets another one', () => {
    const secret = pendingTotpSecret(SECRET, user);
    expect(pendingTotpSecret(SECRET, { ...user, _sid: 'session-b' })).not.toBe(secret);
    expect(pendingTotpSecret(SECRET, { ...user, id: 8 })).not.toBe(secret);
    expect(pendingTotpSecret(SECRET, { ...user, collection: 'admins' })).not.toBe(secret);
    expect(pendingTotpSecret(`${SECRET}x`, user)).not.toBe(secret);
    // An enrollment or a removal of TOTP writes the user: the same session gets a new secret.
    expect(pendingTotpSecret(SECRET, { ...user, updatedAt: '2026-10-31T10:05:00.000Z' })).not.toBe(
      secret,
    );
  });

  it('TT5 no session ID or updatedAt, no secret', () => {
    expect(pendingTotpSecret(SECRET, { collection: 'users', id: 7 })).toBeUndefined();
    expect(pendingTotpSecret(SECRET, { ...user, _sid: '' })).toBeUndefined();
    expect(pendingTotpSecret(SECRET, { ...user, updatedAt: undefined })).toBeUndefined();
  });
});

describe('safeBackPath', () => {
  it('TT6 a path inside the admin is kept with its query', () => {
    expect(safeBackPath('/giris', '/giris/collections/bookings?tab=new')).toBe(
      '/giris/collections/bookings?tab=new',
    );
    expect(safeBackPath('/giris', '/giris')).toBe('/giris');
  });

  it('TT7 anything else lands on the admin root', () => {
    for (const back of [
      undefined,
      '',
      ['/giris/x'],
      '/',
      '/girisx',
      '/giris/../api/users',
      'https://evil.example/giris',
      '//evil.example/giris',
      '/\\evil.example/giris',
      'javascript:alert(1)',
      'http://user:pass@admin.invalid/giris',
    ]) {
      expect(safeBackPath('/giris', back), String(back)).toBe('/giris');
    }
  });
});

describe('withCodeFixes (payload-totp endpoints)', () => {
  const totp = (secret: string) =>
    new TOTP({ secret: Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 });

  function call(path: string, body: unknown, reqUser: object | null = user) {
    const handler = vi.fn(async (req: PayloadRequest) => Response.json(await req.json?.()));
    const endpoint = withCodeFixes({ path, method: 'post', handler } as Endpoint);
    const req = {
      json: async () => body,
      payload: { secret: SECRET },
      user: reqUser,
    } as unknown as PayloadRequest;
    return Promise.resolve(endpoint.handler(req)).then((r) => r.json());
  }

  it('TT8 setup: the token is normalized and the secret is the one the page showed', async () => {
    const shown = pendingTotpSecret(SECRET, user) as string;
    const chosen = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const sent = await call('/setup-totp', { token: '۱۲۳ ۴۵۶', secret: chosen });
    expect(sent).toEqual({ token: '123456', secret: shown });
    // The plugin then validates against that secret: a code of the shown one passes.
    expect(totp(sent.secret).validate({ token: totp(shown).generate(), window: 1 })).toBe(0);
  });

  it('TT9 setup without a user or a session ID names no secret', async () => {
    expect(await call('/setup-totp', { token: '1', secret: 'AAAA' }, null)).toEqual({ token: '1' });
    expect(
      await call('/setup-totp', { token: '1', secret: 'AAAA' }, { collection: 'users', id: 7 }),
    ).toEqual({ token: '1' });
  });

  it('TT10 verify: only the token is normalized; other endpoints pass through', async () => {
    expect(await call('/verify-totp', { token: '٤٥٦ ١٢٣' })).toEqual({ token: '456123' });
    const handler = vi.fn();
    const remove = { path: '/remove-totp', method: 'post', handler } as Endpoint;
    expect(withCodeFixes(remove)).toBe(remove);
    const get = { path: '/setup-totp', method: 'get', handler } as Endpoint;
    expect(withCodeFixes(get)).toBe(get);
  });

  it('TT13 a JSON null body or a token with letters reaches the plugin as its own refusal', async () => {
    let received: unknown = 'not called';
    const endpoint = withCodeFixes({
      path: '/verify-totp',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        received = await req.json?.();
        return Response.json({});
      },
    } as Endpoint);
    await endpoint.handler({ json: async () => null, payload: { secret: SECRET }, user } as never);
    expect(received).toBeUndefined();
    expect(await call('/verify-totp', { token: '12a 456' })).toEqual({ token: '12a456' });
  });

  it('TT11 a body that is not JSON reaches the plugin as undefined (its own refusal)', async () => {
    const handler = vi.fn(async (req: PayloadRequest) =>
      Response.json({ body: (await req.json?.()) ?? null }),
    );
    const endpoint = withCodeFixes({ path: '/verify-totp', method: 'post', handler } as Endpoint);
    const req = {
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
      payload: { secret: SECRET },
      user,
    } as unknown as PayloadRequest;
    expect(await (await endpoint.handler(req)).json()).toEqual({ body: null });
  });
});
