import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('accessLine', () => {
  let writes: string[];
  beforeEach(() => {
    vi.resetModules();
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [k, v] of Object.entries({
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./.data/test.db',
      PAYLOAD_SECRET: 'p'.repeat(43),
      GIT_SHA: 'abc1234',
    })) {
      vi.stubEnv(k, v);
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('AL1 one JSON line with the logger field names, query stripped, phone scrubbed', async () => {
    const { accessLine } = await import('@/lib/log/accessLine');
    accessLine({
      level: 'info',
      msg: 'redirect',
      reqId: 'r1',
      route: '/vip?phone=09123456789',
      to: '/x',
    });
    expect(writes).toHaveLength(1);
    const line = JSON.parse(writes[0] ?? '{}') as Record<string, unknown>;
    expect(line).toMatchObject({
      level: 'info',
      msg: 'redirect',
      reqId: 'r1',
      route: '/vip',
      to: '/x',
      service: 'sefid-web',
      sha: 'abc1234',
    });
    expect(writes[0]).not.toContain('09123456789');
    expect(writes[0]?.endsWith('\n')).toBe(true);
  });

  it('AL2 debug lines follow LOG_LEVEL', async () => {
    const { accessLine } = await import('@/lib/log/accessLine');
    accessLine({ level: 'debug', msg: 'pass', reqId: 'r2' });
    expect(writes).toHaveLength(0);
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'debug');
    const again = await import('@/lib/log/accessLine');
    again.accessLine({ level: 'debug', msg: 'pass', reqId: 'r2' });
    expect(writes).toHaveLength(1);
  });
});
