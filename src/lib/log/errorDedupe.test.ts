import { describe, expect, it } from 'vitest';

import { createErrorDedupe, errorSignature } from '@/lib/log/errorDedupe';

const MIN = 60_000;
const sample = {
  routePath: '/[...notFound]',
  errName: 'Error',
  message: 'db timeout after 2000 ms',
};

describe('errorDedupe (spec 12.5)', () => {
  it('ED1 two identical errors 10 minutes apart notify once; 61 minutes later again', () => {
    const dedupe = createErrorDedupe({ windowMs: 60 * MIN });
    expect(dedupe.record(sample, 0).notify).toBe(true);
    expect(dedupe.record(sample, 10 * MIN).notify).toBe(false);
    const third = dedupe.record(sample, 61 * MIN);
    expect(third.notify).toBe(true);
    expect(third.count).toBe(3);
  });

  it('ED2 digits do not split a signature; route, name and text do', () => {
    expect(errorSignature(sample)).toBe(
      errorSignature({ ...sample, message: 'db timeout after 2500 ms' }),
    );
    expect(errorSignature(sample)).not.toBe(errorSignature({ ...sample, routePath: '/' }));
    expect(errorSignature(sample)).not.toBe(errorSignature({ ...sample, errName: 'TypeError' }));
  });

  it('ED3 entries newest first; bounded', () => {
    const dedupe = createErrorDedupe({ windowMs: MIN, maxEntries: 2 });
    dedupe.record({ ...sample, routePath: '/a' }, 1);
    dedupe.record({ ...sample, routePath: '/b' }, 2);
    dedupe.record({ ...sample, routePath: '/c' }, 3);
    expect(dedupe.entries().map((e) => e.sample.routePath)).toEqual(['/c', '/b']);
  });
});
