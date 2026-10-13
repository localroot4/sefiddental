import { createHash } from 'node:crypto';

export interface ErrorSample {
  routePath: string;
  errName: string;
  message: string;
}

export interface DedupeEntry {
  signature: string;
  count: number;
  firstAt: number;
  lastAt: number;
  lastNotifiedAt: number;
  sample: ErrorSample;
}

export interface ErrorDedupe {
  /** Counts the error; `notify` is true for the first one per signature in each window. */
  record(sample: ErrorSample, nowMs: number): { notify: boolean; signature: string; count: number };
  /** Newest first, for the System status view. */
  entries(): DedupeEntry[];
}

/** Digits vary between repeats of one error (ids, ports, durations), so they are not part of it. */
export function errorSignature(sample: ErrorSample): string {
  const message = sample.message.replace(/[0-9۰-۹٠-٩]+/g, '#');
  return createHash('sha1')
    .update(`${sample.routePath}|${sample.errName}|${message}`)
    .digest('hex');
}

/**
 * Error dedupe for alerts (architecture.md 220-221): one notification per signature per window
 * (default 1 hour, `notifier.errorDedupMinutes`). At most `maxEntries` signatures are kept.
 */
export function createErrorDedupe(opts: { windowMs: number; maxEntries?: number }): ErrorDedupe {
  const maxEntries = opts.maxEntries ?? 500;
  const map = new Map<string, DedupeEntry>();
  return {
    record(sample, nowMs) {
      const signature = errorSignature(sample);
      let entry = map.get(signature);
      if (entry === undefined) {
        if (map.size >= maxEntries) {
          const oldest = [...map.values()].sort((a, b) => a.lastAt - b.lastAt)[0];
          if (oldest) map.delete(oldest.signature);
        }
        entry = {
          signature,
          count: 0,
          firstAt: nowMs,
          lastAt: nowMs,
          lastNotifiedAt: -Infinity,
          sample,
        };
        map.set(signature, entry);
      }
      entry.count += 1;
      entry.lastAt = nowMs;
      entry.sample = sample;
      const notify = nowMs - entry.lastNotifiedAt >= opts.windowMs;
      if (notify) entry.lastNotifiedAt = nowMs;
      return { notify, signature, count: entry.count };
    },
    entries() {
      return [...map.values()].sort((a, b) => b.lastAt - a.lastAt);
    },
  };
}

/** Process-wide instance used by onRequestError; window 60 minutes until the notifier global is read. */
export const requestErrors = createErrorDedupe({ windowMs: 60 * 60 * 1000 });
