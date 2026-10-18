import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const boot = require('./boot.cjs') as {
  loadSecrets: (env: Record<string, string | undefined>, dir: string) => void;
  applyDefaults: (
    env: Record<string, string | undefined>,
    dir: string,
    release: { gitSha?: string; buildTime?: string },
  ) => void;
  seedFirstRun: (env: Record<string, string | undefined>, dir: string, seed: string) => boolean;
  startInternalListener: (
    env: Record<string, string | undefined>,
    next: () => http.Server | null,
  ) => Promise<http.Server>;
  SECRET_NAMES: string[];
};

const closers: Array<() => void> = [];
afterEach(() => {
  while (closers.length) closers.pop()!();
});
const tmp = () => mkdtempSync(path.join(tmpdir(), 'cpanel-boot-'));

describe('cPanel start-up (docs/deploy.md section 3)', () => {
  it('CB1 generates each missing secret once, 0600, and keeps a value the panel set', () => {
    const dir = tmp();
    const env: Record<string, string | undefined> = { CRON_SECRET: 'from-the-panel' };
    boot.loadSecrets(env, dir);
    const file = path.join(dir, 'secrets.json');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    for (const name of boot.SECRET_NAMES.filter((n) => n !== 'CRON_SECRET')) {
      expect(env[name]!.length).toBeGreaterThanOrEqual(43);
    }
    expect(env.CRON_SECRET).toBe('from-the-panel');
    expect(readFileSync(path.join(dir, 'cron-secret'), 'utf8')).toBe('from-the-panel');
    // A restart, or a second process, reads the same values.
    const again: Record<string, string | undefined> = {};
    boot.loadSecrets(again, dir);
    expect(again.PAYLOAD_SECRET).toBe(env.PAYLOAD_SECRET);
    expect(readFileSync(path.join(dir, 'cron-secret'), 'utf8')).toBe(again.CRON_SECRET);
  });

  it('CB2 a secrets file another process wrote first wins', () => {
    const dir = tmp();
    const theirs = Object.fromEntries(boot.SECRET_NAMES.map((n) => [n, `${n}-x`.repeat(5)]));
    writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify(theirs));
    const env: Record<string, string | undefined> = {};
    boot.loadSecrets(env, dir);
    expect(env.IP_HASH_SECRET).toBe(theirs.IP_HASH_SECRET);
  });

  it('CB3 defaults for this host type; anything the panel set wins', () => {
    const env: Record<string, string | undefined> = { TRUSTED_PROXY_HOPS: '2' };
    boot.applyDefaults(env, '/home/u/sefid-data', { gitSha: 'abc1234' });
    expect(env).toMatchObject({
      DATABASE_URL: 'file:/home/u/sefid-data/sefid.db',
      MEDIA_DIR: '/home/u/sefid-data/media',
      DB_PUSH: 'false',
      TRUST_PROXY_HEADERS: 'true',
      TRUSTED_PROXY_HOPS: '2',
      GIT_SHA: 'abc1234',
    });
    expect(env.BUILD_TIME).toBeUndefined();
  });

  it('CB4 the seeded database and media are copied once, never over existing data', () => {
    const dir = tmp();
    const seed = tmp();
    writeFileSync(path.join(seed, 'sefid.db'), 'seeded');
    mkdirSync(path.join(seed, 'media'));
    writeFileSync(path.join(seed, 'media', 'a.webp'), 'img');
    const env: Record<string, string | undefined> = {};
    boot.applyDefaults(env, dir, {});
    expect(boot.seedFirstRun(env, dir, seed)).toBe(true);
    expect(readFileSync(path.join(dir, 'sefid.db'), 'utf8')).toBe('seeded');
    expect(existsSync(path.join(dir, 'media', 'a.webp'))).toBe(true);
    writeFileSync(path.join(dir, 'sefid.db'), 'live data');
    expect(boot.seedFirstRun(env, dir, seed)).toBe(false);
    expect(readFileSync(path.join(dir, 'sefid.db'), 'utf8')).toBe('live data');
    // Another database (PostgreSQL) is never seeded from the file.
    expect(boot.seedFirstRun({ DATABASE_URL: 'postgres://x' }, tmp(), seed)).toBe(false);
  });

  it('CB5 the loopback listener hands only /api/internal/* to Next, past a loader that owns listen()', async () => {
    // A panel loader: the first http listen() is taken, a second one throws (Passenger, lsnode).
    const original = http.Server.prototype.listen;
    http.Server.prototype.listen = function () {
      throw new Error('listen() called twice under the loader');
    } as never;
    closers.push(() => (http.Server.prototype.listen = original));
    let next: http.Server | null = null;
    const env: Record<string, string | undefined> = {};
    const internal = await boot.startInternalListener(env, () => next);
    closers.push(() => internal.close());
    expect(env.INTERNAL_ORIGIN).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const get = async (p: string) => (await fetch(new URL(p, env.INTERNAL_ORIGIN))).status;
    expect(await get('/api/internal/proxy-config')).toBe(503);
    next = http.createServer((_req, res) => {
      res.statusCode = 204;
      res.end();
    });
    expect(await get('/api/internal/proxy-config')).toBe(204);
    expect(await get('/')).toBe(404);
    expect(await get('/admin')).toBe(404);
  });
});
