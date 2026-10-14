import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

const { count, getPayloadClient } = vi.hoisted(() => {
  const count = vi.fn<() => Promise<{ totalDocs: number }>>();
  return { count, getPayloadClient: vi.fn(async () => ({ count })) };
});
vi.mock('@/lib/data/payload', () => ({ getPayloadClient }));

const load = async () => import('./route');

describe('GET and HEAD /api/health (spec 11.1)', () => {
  beforeEach(() => {
    stubSiteEnv({ GIT_SHA: 'dff3ac0' });
    count.mockReset();
    getPayloadClient.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('HR1 database up: 200, the public shape only, no-store', async () => {
    count.mockResolvedValue({ totalDocs: 2 });
    const { GET } = await load();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['checks', 'maintenance', 'status', 'time', 'uptimeSeconds', 'version'].sort(),
    );
    expect(body).toMatchObject({
      status: 'ok',
      version: 'dff3ac0',
      maintenance: false,
      checks: { database: { status: 'ok', latencyMs: expect.any(Number) } },
    });
    expect(count).toHaveBeenCalledWith({ collection: 'users', overrideAccess: true });
  });

  it('HR2 a database that never answers: 503 "down" after the 2000 ms race', async () => {
    vi.useFakeTimers();
    count.mockReturnValue(new Promise(() => {}));
    const { GET } = await load();
    const pending = GET();
    await vi.advanceTimersByTimeAsync(2000);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: 'down',
      checks: { database: { status: 'down', latencyMs: null } },
    });
  });

  it('HR3 Payload cannot start (connection refused): 503', async () => {
    getPayloadClient.mockRejectedValueOnce(new Error('cannot connect to Postgres'));
    const { GET } = await load();
    expect((await GET()).status).toBe(503);
  });

  it('HR4 HEAD has the status and headers and no body; the probe is memoized', async () => {
    count.mockResolvedValue({ totalDocs: 2 });
    const { GET, HEAD } = await load();
    const head = await HEAD();
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(head.headers.get('cache-control')).toBe('no-store');
    await GET();
    expect(count).toHaveBeenCalledTimes(1);
  });
});
