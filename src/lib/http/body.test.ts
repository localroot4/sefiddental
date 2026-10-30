import { describe, expect, it } from 'vitest';

import { readTextCapped } from './body';

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://localhost/x', { method: 'POST', body, headers });

describe('readTextCapped', () => {
  it('BD1 reads a body up to the limit; a larger or a non-numeric declared size is refused unread', async () => {
    expect(await readTextCapped(post('سلام'), 8)).toBe('سلام');
    // Eight UTF-8 bytes for four letters: the limit counts bytes.
    expect(await readTextCapped(post('سلام'), 7)).toBeNull();
    const req = post('x', { 'content-length': 'abc' });
    expect(await readTextCapped(req, 1024)).toBeNull();
    expect(req.bodyUsed).toBe(false);
  });
});
