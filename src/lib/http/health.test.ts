import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabaseHealth, withTimeout } from '@/lib/http/health';

describe('health probe (spec 11.1, critic W11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('HL1 a probe that hangs is reported down after 2000 ms', async () => {
    let clock = 0;
    const check = createDatabaseHealth({
      probe: () => new Promise(() => undefined),
      now: () => clock,
    });
    const pending = check();
    await vi.advanceTimersByTimeAsync(1999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    clock = 2000;
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ status: 'down', latencyMs: null, checkedAt: 0 });
  });

  it('HL2 ok with latency; a failing probe is down', async () => {
    let clock = 100;
    const ok = createDatabaseHealth({ probe: async () => (clock += 3), now: () => clock });
    await expect(ok()).resolves.toEqual({ status: 'ok', latencyMs: 3, checkedAt: 100 });
    const bad = createDatabaseHealth({
      probe: () => Promise.reject(new Error('ECONNREFUSED')),
      now: () => 0,
    });
    await expect(bad()).resolves.toMatchObject({ status: 'down' });
  });

  it('HL3 memoized for 5 s and single flight', async () => {
    let clock = 0;
    const probe = vi.fn(async () => 1);
    const check = createDatabaseHealth({ probe, now: () => clock });
    await Promise.all([check(), check()]);
    expect(probe).toHaveBeenCalledTimes(1);
    clock = 4999;
    await check();
    expect(probe).toHaveBeenCalledTimes(1);
    clock = 5000;
    await check();
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('HL4 withTimeout passes a fast result through', async () => {
    await expect(withTimeout(Promise.resolve('x'), 10)).resolves.toBe('x');
  });
});
