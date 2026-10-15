import { describe, expect, it, vi } from 'vitest';

import { dbKindFromUrl, parseEnv } from './env';

const BASE = { DATABASE_URL: 'file:./.data/test.db', PAYLOAD_SECRET: 'p'.repeat(43) };
const SECRET = 's'.repeat(43);
const PROD = {
  ...BASE,
  NODE_ENV: 'production',
  SITE_URL: 'https://sefiddental.ir',
  GIT_SHA: 'abc123',
  MEDIA_DIR: '/srv/media',
  CRON_SECRET: 'c'.repeat(43),
  INTERNAL_API_TOKEN: 'i'.repeat(43),
  IP_HASH_SECRET: 'h'.repeat(43),
  FORM_TOKEN_SECRET: SECRET,
};
const OLD = 'o'.repeat(43);

describe('env', () => {
  it('E1 dbKindFromUrl picks the adapter from the scheme', () => {
    expect(dbKindFromUrl('postgres://u:p@h:5432/d')).toBe('postgres');
    expect(dbKindFromUrl('postgresql://u:p@h/d')).toBe('postgres');
    expect(dbKindFromUrl('file:./.data/dev.db')).toBe('sqlite');
    expect(() => dbKindFromUrl('mysql://h/d')).toThrow(/unknown scheme/);
  });

  it('E2 development fills defaults and random secrets', () => {
    const env = parseEnv({ ...BASE, NODE_ENV: 'development' });
    expect(env.siteUrl).toBe('http://localhost:3000');
    expect(env.gitSha).toBe('dev');
    expect(env.cronSecret.length).toBeGreaterThanOrEqual(43);
    expect(env.allowFirstUser).toBe(false);
    expect(env.cspAdminMode).toBe('enforce');
    expect(env.internalOrigin).toBe('http://127.0.0.1:3000');
    expect(env.s3).toBeNull();
    expect(env.smtp).toBeNull();
    expect(env.formSessionRateLimit).toBe(60);
    expect(parseEnv({ ...BASE, FORM_SESSION_RATE_LIMIT: '500' }).formSessionRateLimit).toBe(500);
    expect(() => parseEnv({ ...BASE, FORM_SESSION_RATE_LIMIT: '0' })).toThrow(
      /FORM_SESSION_RATE_LIMIT/,
    );
  });

  it('E3 production names every missing value and never prints one', () => {
    expect(() =>
      parseEnv({ ...BASE, NODE_ENV: 'production', CRON_SECRET: 'short-secret' }),
    ).toThrow(
      /SITE_URL missing[\s\S]*GIT_SHA missing[\s\S]*MEDIA_DIR missing[\s\S]*CRON_SECRET too short/,
    );
    try {
      parseEnv({ ...BASE, NODE_ENV: 'production', CRON_SECRET: 'short-secret' });
    } catch (error) {
      expect((error as Error).message).not.toContain('short-secret');
    }
  });

  it('E4 the build phase needs only DATABASE_URL and PAYLOAD_SECRET', () => {
    const env = parseEnv({ ...BASE, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' });
    expect(env.nodeEnv).toBe('production');
    expect(() =>
      parseEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }),
    ).toThrow(/DATABASE_URL missing[\s\S]*PAYLOAD_SECRET missing/);
  });

  it('E4b the build phase fills missing dev secrets without a warning line', async () => {
    // A fresh module: the per-process secrets of earlier tests would skip the warning anyway.
    vi.resetModules();
    const fresh = await import('./env');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const build = { ...BASE, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' };
      const env = fresh.parseEnv(build);
      expect(env.ipHashSecret.length).toBeGreaterThanOrEqual(43);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('E5 a complete production environment parses', () => {
    const env = parseEnv({ ...PROD, FORM_TOKEN_SECRET_PREVIOUS: OLD, MAINTENANCE_MODE: 'on' });
    expect(env.formTokenSecrets).toEqual([SECRET, OLD]);
    expect(env.maintenance).toBe(true);
    expect(env.mediaDir).toBe('/srv/media');
  });

  it('E5b production refuses a short previous form key and one value for two secrets (SEC-S6)', () => {
    expect(() => parseEnv({ ...PROD, FORM_TOKEN_SECRET_PREVIOUS: 'old' })).toThrow(
      /FORM_TOKEN_SECRET_PREVIOUS too short/,
    );
    expect(() => parseEnv({ ...PROD, CRON_SECRET: PROD.PAYLOAD_SECRET })).toThrow(
      /secrets must differ/,
    );
    // Development keeps working with a short placeholder.
    expect(parseEnv({ ...BASE, FORM_TOKEN_SECRET_PREVIOUS: 'old' }).formTokenSecrets).toHaveLength(
      2,
    );
  });

  it('E5c a loopback IP as HOSTNAME is refused; localhost and 0.0.0.0 bind (CSP-1)', () => {
    for (const HOSTNAME of ['127.0.0.1', '127.1.2.3', '::1', '[::1]']) {
      expect(() => parseEnv({ ...PROD, HOSTNAME }), HOSTNAME).toThrow(/HOSTNAME is a loopback IP/);
      expect(() => parseEnv({ ...BASE, HOSTNAME }), HOSTNAME).toThrow(/HOSTNAME is a loopback IP/);
    }
    for (const HOSTNAME of ['localhost', '0.0.0.0', 'web-1', '']) {
      expect(parseEnv({ ...PROD, HOSTNAME }).siteUrl, HOSTNAME).toBe('https://sefiddental.ir');
    }
  });

  it('E5d a missing dev secret is the same in every copy of this module (SEC-S7)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      vi.resetModules();
      const a = (await import('./env')).parseEnv(BASE);
      vi.resetModules();
      const b = (await import('./env')).parseEnv(BASE);
      expect(b.internalApiToken).toBe(a.internalApiToken);
      expect(b.formTokenSecrets).toEqual(a.formTokenSecrets);
      expect(a.internalApiToken).not.toBe(a.cronSecret);
      expect(a.internalApiToken.length).toBeGreaterThanOrEqual(43);
    } finally {
      warn.mockRestore();
    }
  });

  it('E6 SITE_URL must be an apex origin without a trailing slash', () => {
    expect(() => parseEnv({ ...PROD, SITE_URL: 'https://sefiddental.ir/' })).toThrow(/origin/);
    expect(() => parseEnv({ ...PROD, SITE_URL: 'https://www.sefiddental.ir' })).toThrow(/apex/);
    expect(() => parseEnv({ ...PROD, SITE_URL: 'not a url' })).toThrow(/origin/);
  });

  it('E7 flags accept true/false, on/off, 1/0 in any case', () => {
    const env = parseEnv({
      ...BASE,
      ALLOW_FIRST_USER: 'TRUE',
      QA_ROUTES: '1',
      ALLOW_INDEXING: 'off',
    });
    expect(env.allowFirstUser).toBe(true);
    expect(env.qaRoutes).toBe(true);
    expect(env.allowIndexing).toBe(false);
    expect(() => parseEnv({ ...BASE, ALLOW_INDEXING: 'maybe' })).toThrow(/ALLOW_INDEXING/);
  });

  it('E8 storage and mail blocks need their companion values', () => {
    expect(() => parseEnv({ ...BASE, S3_BUCKET: 'media' })).toThrow(/S3_ACCESS_KEY_ID missing/);
    expect(() => parseEnv({ ...BASE, SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_FROM missing/);
    const env = parseEnv({
      ...BASE,
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'no-reply@example.com',
    });
    expect(env.smtp).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
    });
  });

  it('E10 notifier credentials: optional, Farapayamak needs both values, values never printed', () => {
    const none = parseEnv(BASE);
    expect([none.telegram, none.farapayamak]).toEqual([null, null]);
    const env = parseEnv({
      ...BASE,
      TELEGRAM_BOT_TOKEN: '123:token-value',
      FARAPAYAMAK_USERNAME: 'clinic',
      FARAPAYAMAK_PASSWORD: 'pass-value',
    });
    expect(env.telegram).toEqual({ botToken: '123:token-value' });
    expect(env.farapayamak).toEqual({ username: 'clinic', password: 'pass-value' });
    expect(() => parseEnv({ ...BASE, FARAPAYAMAK_USERNAME: 'clinic' })).toThrow(
      /FARAPAYAMAK_PASSWORD missing/,
    );
    const message = (() => {
      try {
        parseEnv({ ...BASE, FARAPAYAMAK_PASSWORD: 'pass-value' });
        return '';
      } catch (error) {
        return String(error);
      }
    })();
    expect(message).toMatch(/FARAPAYAMAK_USERNAME missing/);
    expect(message).not.toContain('pass-value');
  });

  it('E9 MEDIA_DIR must be absolute', () => {
    expect(() => parseEnv({ ...BASE, MEDIA_DIR: 'media' })).toThrow(
      /MEDIA_DIR must be an absolute/,
    );
  });
});
