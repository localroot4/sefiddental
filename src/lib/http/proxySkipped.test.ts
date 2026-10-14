import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config';

const headersOf = async (path: string) =>
  (await unstable_getResponseFromNextConfig({ url: `https://sefiddental.ir${path}`, nextConfig }))
    .headers;

describe('headers of the paths the proxy skips (CSP-3)', () => {
  it.each([
    '/brand/x',
    '/fonts/x',
    '/detect-gpu/x',
    '/favicon.ico.x',
    '/favicon.icox',
    '/api/media/file/a.jpg',
  ])('PS1 %s cannot be framed', async (path) => {
    const headers = await headersOf(path);
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each(['/api/media', '/api/media/1', '/api/mediax'])(
    'PS2 %s gets the API policy and noindex',
    async (path) => {
      const headers = await headersOf(path);
      expect(headers.get('content-security-policy')).toBe(
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );
      expect(headers.get('x-robots-tag')).toBe('noindex');
    },
  );

  it('PS3 media files keep the image viewable and indexable', async () => {
    const headers = await headersOf('/api/media/file/a.jpg');
    expect(headers.get('content-security-policy')).not.toContain('default-src');
    expect(headers.get('x-robots-tag')).toBeNull();
  });
});
