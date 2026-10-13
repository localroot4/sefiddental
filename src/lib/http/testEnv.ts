import { vi } from 'vitest';

import { readEnv, type ServerEnv } from '@/lib/env';

/*
 * Test fixtures of the platform lane (imported by *.test.ts only): a parsed environment for
 * modules that take `env`, and a process.env stub for modules that call readEnv() themselves.
 */

const SECRET = 's'.repeat(48);

const PRODUCTION = {
  NODE_ENV: 'production',
  SITE_URL: 'https://sefiddental.ir',
  GIT_SHA: 'abc1234',
  DATABASE_URL: 'file:./.data/test.db',
  PAYLOAD_SECRET: SECRET,
  CRON_SECRET: SECRET,
  INTERNAL_API_TOKEN: 'i'.repeat(48),
  IP_HASH_SECRET: SECRET,
  FORM_TOKEN_SECRET: SECRET,
  MEDIA_DIR: '/srv/media',
};

/** A complete production environment on https://sefiddental.ir, plus overrides. */
export function testEnv(overrides: Record<string, string> = {}): ServerEnv {
  return readEnv({ ...PRODUCTION, ...overrides });
}

/**
 * Stubs process.env (NODE_ENV 'test' unless overridden) and resets the module registry, so a
 * dynamic import after this call reads the stubbed values. Undo with vi.unstubAllEnvs().
 */
export function stubSiteEnv(extra: Record<string, string> = {}): void {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...PRODUCTION, NODE_ENV: 'test', ...extra })) {
    vi.stubEnv(key, value);
  }
}
