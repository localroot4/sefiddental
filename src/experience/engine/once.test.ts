import { describe, expect, it, vi } from 'vitest';

import { once } from './once';

describe('once', () => {
  it('EN1 two calls run the function once; a throw still marks it done', () => {
    const fn = vi.fn();
    const run = once(fn);
    run();
    run();
    expect(fn).toHaveBeenCalledTimes(1);

    const failing = once(() => {
      throw new Error('boom');
    });
    expect(() => failing()).toThrow('boom');
    expect(() => failing()).not.toThrow();
  });
});
