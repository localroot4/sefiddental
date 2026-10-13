export interface RateLimiter {
  hit(key: string, nowMs: number): { ok: true } | { ok: false; retryAfterSec: number };
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counter per key, in memory (one process; one instance by design, spec 8). At most
 * `maxKeys` windows are kept: expired windows go first, then the oldest. `nowMs` is injected so
 * tests control time.
 */
export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 10_000;
  if (!(limit >= 1 && windowMs >= 1 && maxKeys >= 1)) {
    throw new RangeError('createRateLimiter: limit, windowMs and maxKeys must be at least 1');
  }
  const windows = new Map<string, Bucket>();

  const makeRoom = (nowMs: number) => {
    for (const [key, w] of windows) if (w.resetAt <= nowMs) windows.delete(key);
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  };

  return {
    hit(key, nowMs) {
      let w = windows.get(key);
      if (w === undefined || w.resetAt <= nowMs) {
        if (w === undefined && windows.size >= maxKeys) makeRoom(nowMs);
        windows.delete(key);
        w = { count: 0, resetAt: nowMs + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      if (w.count <= limit) return { ok: true };
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - nowMs) / 1000)) };
    },
  };
}
