import { describe, expect, it } from 'vitest';

import { smoothstep, stickyTop } from './anchor';

describe('stickyTop (a pinned stage in the viewport)', () => {
  const stage = { docTop: 1260, navH: 72, roomHeight: 1800, pinned: true };

  it('ST1 in flow before the pin, under the nav through the room, then scrolled away', () => {
    expect(stickyTop(0, stage)).toBe(1260);
    expect(stickyTop(1188, stage)).toBe(72);
    expect(stickyTop(2000, stage)).toBe(72);
    expect(stickyTop(1188 + 1800, stage)).toBe(72);
    expect(stickyTop(1188 + 1900, stage)).toBe(-28);
  });

  it('ST2 an unpinned layout scrolls in flow', () => {
    expect(stickyTop(2000, { ...stage, pinned: false })).toBe(-740);
  });
});

describe('smoothstep', () => {
  it('SM1 clamps and eases; equal edges are a step', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
    expect(smoothstep(1, 1, 1)).toBe(1);
  });
});
