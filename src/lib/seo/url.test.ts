import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

describe('absoluteUrl (spec 9.1)', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => vi.unstubAllEnvs());

  it('U1 percent-encodes Persian, keeps the fragment, uses SITE_URL', async () => {
    const { absoluteUrl, siteUrl } = await import('@/lib/seo/url');
    expect(siteUrl()).toBe('https://sefiddental.ir');
    expect(absoluteUrl('/')).toBe('https://sefiddental.ir/');
    expect(absoluteUrl('/خدمات#سطح')).toBe(
      'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA#%D8%B3%D8%B7%D8%AD',
    );
  });

  it('U2 rejects anything that is not a site path', async () => {
    const { absoluteUrl } = await import('@/lib/seo/url');
    for (const bad of ['https://evil.example/', '//evil.example/x', 'relative']) {
      expect(() => absoluteUrl(bad), bad).toThrow(TypeError);
    }
  });
});
