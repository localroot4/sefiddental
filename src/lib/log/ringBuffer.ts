/** Fixed-size buffer of the newest log lines; the System status view shows it (spec 12.5). */
export interface RingBuffer {
  push(line: string): void;
  /** Newest first. */
  entries(): string[];
  readonly capacity: number;
}

export function createRingBuffer(capacity: number): RingBuffer {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError('createRingBuffer: capacity must be a positive integer');
  }
  const lines: string[] = [];
  let next = 0;
  return {
    capacity,
    push(line) {
      if (lines.length < capacity) lines.push(line);
      else lines[next] = line;
      next = (next + 1) % capacity;
    },
    entries() {
      const ordered =
        lines.length < capacity ? lines.slice() : [...lines.slice(next), ...lines.slice(0, next)];
      return ordered.reverse();
    },
  };
}

/** True for the first line of a key in each window (keys are cleared past `maxKeys`). */
export function createRepeatFilter(windowMs: number, maxKeys = 500) {
  const seen = new Map<string, number>();
  return (key: string, nowMs: number): boolean => {
    const last = seen.get(key);
    if (last !== undefined && nowMs - last < windowMs) return false;
    if (seen.size >= maxKeys) seen.clear();
    seen.set(key, nowMs);
    return true;
  };
}

// One instance per process. The bundler copies this module into each server layer (route
// handlers, pages, instrumentation); every copy must share the buffer the status view reads.
const store = globalThis as typeof globalThis & {
  __sefidWarnLines?: RingBuffer;
  __sefidRingRepeats?: ReturnType<typeof createRepeatFilter>;
  __sefidStartedAt?: string;
};

/** Last 200 warn, error and fatal lines of this process (already redacted); empty after a restart. */
export const warnLines = (store.__sefidWarnLines ??= createRingBuffer(200));

/** The ring keeps one line per level and message per 10 minutes: a flood never evicts the rest. */
export const ringRepeats = (store.__sefidRingRepeats ??= createRepeatFilter(10 * 60_000));

/** Shown next to the buffer: the buffer covers this process only. */
export const processStartedAt = (store.__sefidStartedAt ??= new Date().toISOString());
