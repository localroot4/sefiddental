import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { databaseAdapter, logPoolErrors } from './db';

/** The push flag the SQLite adapter ends up with (init builds the adapter without connecting). */
function pushOf(value: string | undefined): unknown {
  vi.stubEnv('DATABASE_URL', 'file:./.data/never-opened.db');
  vi.stubEnv('DB_PUSH', value);
  const adapter = databaseAdapter(process.cwd()).init({
    payload: { logger: console, config: {} },
  } as never) as unknown as { push?: unknown };
  return adapter.push;
}

describe('databaseAdapter push (SEC-S3)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('DB1 every falsy word of the env flags turns push off', () => {
    for (const value of ['false', 'FALSE', ' off ', '0', 'no'])
      expect(pushOf(value), value).toBe(false);
  });

  it('DB2 unset, blank or true keeps push on (throwaway local databases)', () => {
    for (const value of [undefined, '', 'true', '1'])
      expect(pushOf(value), String(value)).toBe(true);
  });
});

describe('logPoolErrors (SEC-S5)', () => {
  it('DB3 a dropped idle client is one warn line, not an uncaught exception', () => {
    const pool = new EventEmitter();
    const lines: Record<string, unknown>[] = [];
    logPoolErrors({ pool }, (line) => lines.push(line));
    const err = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
      client: { secretKey: 123 },
    });
    expect(() => pool.emit('error', err)).not.toThrow();
    expect(lines).toEqual([
      {
        msg: 'db_pool_error',
        code: '57P01',
        reason: 'terminating connection due to administrator command',
      },
    ]);
    expect(() => logPoolErrors({}, () => undefined)).not.toThrow();
  });
});
