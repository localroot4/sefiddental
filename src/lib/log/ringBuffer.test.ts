import { describe, expect, it, vi } from 'vitest';

import { createRepeatFilter, createRingBuffer } from '@/lib/log/ringBuffer';

describe('createRingBuffer', () => {
  it('RB1 newest first, at most `capacity` lines', () => {
    const ring = createRingBuffer(3);
    for (const line of ['a', 'b', 'c', 'd', 'e']) ring.push(line);
    expect(ring.entries()).toEqual(['e', 'd', 'c']);
  });

  it('RB2 partly filled', () => {
    const ring = createRingBuffer(3);
    ring.push('a');
    ring.push('b');
    expect(ring.entries()).toEqual(['b', 'a']);
  });

  it('RB3 rejects a non-positive capacity', () => {
    expect(() => createRingBuffer(0)).toThrow(RangeError);
  });

  it('RB4 every copy of the module shares one buffer and start time (SEC-S2)', async () => {
    vi.resetModules();
    const a = await import('@/lib/log/ringBuffer');
    vi.resetModules();
    const b = await import('@/lib/log/ringBuffer');
    a.warnLines.push('from-route-handler');
    expect(b.warnLines.entries()[0]).toBe('from-route-handler');
    expect(b.processStartedAt).toBe(a.processStartedAt);
    vi.resetModules();
    const c = await import('@/lib/log/errorDedupe');
    vi.resetModules();
    const d = await import('@/lib/log/errorDedupe');
    expect(d.requestErrors).toBe(c.requestErrors);
  });

  it('RB5 the repeat filter passes the first line of a key per window', () => {
    const keep = createRepeatFilter(1000, 2);
    expect(keep('a', 0)).toBe(true);
    expect(keep('a', 999)).toBe(false);
    expect(keep('b', 999)).toBe(true);
    expect(keep('a', 1000)).toBe(true);
  });
});
