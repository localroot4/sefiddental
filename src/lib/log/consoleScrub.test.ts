import { inspect } from 'node:util';

import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { scrubConsole } from '@/lib/log/consoleScrub';

const NAME = 'علی رضایی';

describe('scrubConsole (S3)', () => {
  it('CS1 what Next prints for an uncaught failed query holds no value, phone or detail', () => {
    const error = vi.fn();
    const warn = vi.fn();
    const target = { error, warn };
    scrubConsole(target);
    // A Postgres driver error: its message may quote the value, `detail` may hold the row.
    const pg = Object.assign(new Error(`invalid input syntax for type integer: "${NAME}"`), {
      code: '22P02',
      detail: `Failing row contains (12, ${NAME}, درد شدید).`,
    });
    const err = new DrizzleQueryError('select 1 where "name" like $1', [`%${NAME}%`], pg);
    // Next 16.4 production: routerServerContext.logErrorWithOriginalStack -> console.error(prefix, err).
    target.error('⨯', err);
    target.warn('lookup for 09121234567', { kept: 1 });
    const printed = inspect([error.mock.calls, warn.mock.calls], { depth: 10 });
    for (const value of [NAME, 'درد شدید', '9121234567']) expect(printed).not.toContain(value);
    expect(error.mock.calls[0]?.[1]).toMatchObject({
      type: 'DrizzleQueryError',
      params: '[redacted]',
      causes: [{ type: 'Error', code: '22P02' }],
    });
    expect(warn.mock.calls[0]).toEqual(['lookup for [phone]', { kept: 1 }]);
  });

  it('CS2 the process console is wrapped once', () => {
    const saved = { error: console.error, warn: console.warn };
    try {
      scrubConsole();
      const wrapped = console.error;
      scrubConsole();
      expect(console.error).toBe(wrapped);
      expect(console.error).not.toBe(saved.error);
    } finally {
      Object.assign(console, saved);
      delete (globalThis as { __sefidConsoleScrubbed?: true }).__sefidConsoleScrubbed;
    }
  });
});
