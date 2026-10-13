import { describe, expect, it } from 'vitest';

import { createRingBuffer } from '@/lib/log/ringBuffer';

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
});
