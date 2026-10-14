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

/** Last 200 warn, error and fatal lines of this process (already redacted); empty after a restart. */
export const warnLines = createRingBuffer(200);

/** Shown next to the buffer: the buffer covers this process only. */
export const processStartedAt = new Date().toISOString();
