import { describe, expect, it } from 'vitest';

import { dbKindFromUrl, parseEnv } from './env';

const BASE = { DATABASE_URL: 'file:./.data/test.db', PAYLOAD_SECRET: 'p'.repeat(43) };
const SECRET = 's'.repeat(43);
const PROD = {
  ...BASE,
  NODE_ENV: 'production',
  SITE_URL: 'https://sefiddental.ir',
  GIT_SHA: 'abc123',
  MEDIA_DIR: '/srv/media',
  CRON_SECRET: SECRET,
  INTERNAL_API_TOKEN: SECRET,
  IP_HASH_SECRET: SECRET,
  FORM_TOKEN_SECRET: SECRET,
};

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
    expect(env.cspAdminMode).toBe('report-only');
    expect(env.internalOrigin).toBe('http://127.0.0.1:3000');
    expect(env.s3).toBeNull();
    expect(env.smtp).toBeNull();
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

  it('E5 a complete production environment parses', () => {
    const env = parseEnv({ ...PROD, FORM_TOKEN_SECRET_PREVIOUS: 'old', MAINTENANCE_MODE: 'on' });
    expect(env.formTokenSecrets).toEqual([SECRET, 'old']);
    expect(env.maintenance).toBe(true);
    expect(env.mediaDir).toBe('/srv/media');
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

  it('E9 MEDIA_DIR must be absolute', () => {
    expect(() => parseEnv({ ...BASE, MEDIA_DIR: 'media' })).toThrow(
      /MEDIA_DIR must be an absolute/,
    );
  });
});
