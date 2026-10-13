import { describe, expect, it } from 'vitest';

import { createRateLimiter } from '@/lib/http/rateLimit';

const MIN = 60_000;

describe('createRateLimiter', () => {
  it('L1 allows `limit` hits per window, then answers with Retry-After seconds', () => {
    const limiter = createRateLimiter({ limit: 10, windowMs: 15 * MIN });
    for (let i = 0; i < 10; i += 1) expect(limiter.hit('k', 1000 + i)).toEqual({ ok: true });
    expect(limiter.hit('k', 2000)).toEqual({ ok: false, retryAfterSec: 899 });
  });

  it('L2 opens again when the window ends', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MIN });
    expect(limiter.hit('k', 0).ok).toBe(true);
    expect(limiter.hit('k', MIN - 1).ok).toBe(false);
    expect(limiter.hit('k', MIN).ok).toBe(true);
  });

  it('L3 keys are independent', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MIN });
    expect(limiter.hit('a', 0).ok).toBe(true);
    expect(limiter.hit('b', 0).ok).toBe(true);
    expect(limiter.hit('a', 1).ok).toBe(false);
  });

  it('L4 keeps at most maxKeys windows, expired ones evicted first', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MIN, maxKeys: 2 });
    limiter.hit('a', 0);
    limiter.hit('b', MIN / 2);
    limiter.hit('c', MIN + 1); // 'a' expired: evicted, 'b' kept
    expect(limiter.hit('b', MIN + 2).ok).toBe(false);
    limiter.hit('d', MIN + 3); // full, none expired: oldest ('b') evicted
    expect(limiter.hit('b', MIN + 4).ok).toBe(true);
  });

  it('L5 Retry-After is at least one second', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.hit('k', 0);
    expect(limiter.hit('k', 999)).toEqual({ ok: false, retryAfterSec: 1 });
  });

  it('L6 rejects a nonsense configuration', () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: MIN })).toThrow(RangeError);
  });
});
