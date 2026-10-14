/** Result of one database probe, memoized so /api/health cannot be used to load the database. */
export interface DatabaseCheck {
  status: 'ok' | 'down';
  latencyMs: number | null;
  checkedAt: number;
}

export const HEALTH_DB_TIMEOUT_MS = 2000;
export const HEALTH_MEMO_MS = 5000;

class HealthTimeoutError extends Error {
  constructor(ms: number) {
    super(`database check exceeded ${ms} ms`);
    this.name = 'HealthTimeoutError';
  }
}

/** Rejects after `ms` unless `promise` settles first; the timer never keeps the process alive. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HealthTimeoutError(ms)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Health probe runner (spec 11.1, critic W11): `probe` (for example `payload.count` on users)
 * races a 2000 ms timeout, because a stopped database can hold a pool connect longer. One probe
 * at a time; the result is reused for `memoMs`. `now` is injectable for tests. `onChange` hears
 * each change of status (the first result only when it is down) with the probe's error, so the
 * log says why the site went down (SEC-S5).
 */
export function createDatabaseHealth(opts: {
  probe: () => Promise<unknown>;
  timeoutMs?: number;
  memoMs?: number;
  now?: () => number;
  onChange?: (check: DatabaseCheck, error: unknown) => void;
}): () => Promise<DatabaseCheck> {
  const timeoutMs = opts.timeoutMs ?? HEALTH_DB_TIMEOUT_MS;
  const memoMs = opts.memoMs ?? HEALTH_MEMO_MS;
  const now = opts.now ?? Date.now;
  let last: DatabaseCheck | null = null;
  let inflight: Promise<DatabaseCheck> | null = null;

  return () => {
    const started = now();
    if (last !== null && started - last.checkedAt < memoMs) return Promise.resolve(last);
    if (inflight) return inflight;
    let error: unknown = null;
    inflight = withTimeout(Promise.resolve().then(opts.probe), timeoutMs)
      .then((): DatabaseCheck => ({ status: 'ok', latencyMs: now() - started, checkedAt: started }))
      .catch((err: unknown): DatabaseCheck => {
        error = err;
        return { status: 'down', latencyMs: null, checkedAt: started };
      })
      .then((result) => {
        if (result.status !== (last?.status ?? 'ok')) opts.onChange?.(result, error);
        last = result;
        inflight = null;
        return result;
      });
    return inflight;
  };
}
