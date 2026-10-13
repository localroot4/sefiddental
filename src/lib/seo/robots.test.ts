import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

const load = () => import('@/lib/seo/robots');
const LAMINATE =
  'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA/%D9%84%D9%85%DB%8C%D9%86%D8%AA-%D8%B3%D8%B1%D8%A7%D9%85%DB%8C%DA%A9%DB%8C';

describe('canonicalUrl (spec 9.3)', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => vi.unstubAllEnvs());

  it('CU1 page 1 is the base list; page 3 keeps ?page=3', async () => {
    const { canonicalUrl } = await load();
    expect(canonicalUrl('/مقالات', { page: '1' })).toBe(
      new URL('/مقالات', 'https://sefiddental.ir').href,
    );
    expect(canonicalUrl('/مقالات', { page: '3' })).toBe(
      `${new URL('/مقالات', 'https://sefiddental.ir').href}?page=3`,
    );
    expect(
      canonicalUrl('/مقالات/دسته/پیشگیری', new URLSearchParams('page=2&utm_source=x')),
    ).toMatch(/\?page=2$/);
  });

  it('CU2 filters and tracking keys are dropped', async () => {
    const { canonicalUrl } = await load();
    expect(canonicalUrl('/قبل-و-بعد', { service: 'implant', utm_source: 'x' })).toBe(
      new URL('/قبل-و-بعد', 'https://sefiddental.ir').href,
    );
    expect(canonicalUrl('/خدمات/لمینت-سرامیکی', { utm_source: 'x' })).toBe(LAMINATE);
    expect(canonicalUrl('/مقالات/برچسب/ایمپلنت', { page: '2' })).not.toContain('?');
  });

  it('CU3 page values that are not integers of 2 or more are dropped', async () => {
    const { canonicalUrl } = await load();
    for (const page of ['0', '1', '-2', '2.5', 'abc', '']) {
      expect(canonicalUrl('/مقالات', { page })).not.toContain('?');
    }
    expect(canonicalUrl('/مقالات', { page: '007' })).toMatch(/\?page=7$/);
  });
});

describe('pageRobots (spec 9.3, ia.md)', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => vi.unstubAllEnvs());

  it('RB1 staging is noindex, nofollow everywhere', async () => {
    const { pageRobots } = await load();
    expect(pageRobots({ path: '/', allowIndexing: false })).toEqual({
      index: false,
      follow: false,
    });
  });

  it('RB2 route table', async () => {
    const { pageRobots } = await load();
    const r = (path: string, extra: { noindex?: boolean; categoryPublishedCount?: number } = {}) =>
      pageRobots({ path, allowIndexing: true, ...extra });
    expect(r('/')).toEqual({ index: true, follow: true });
    expect(r('/رزرو-نوبت')).toEqual({ index: true, follow: true });
    expect(r('/رزرو-نوبت/ثبت-شد')).toEqual({ index: false, follow: true });
    expect(r('/مقالات/برچسب/ایمپلنت')).toEqual({ index: false, follow: true });
    expect(r('/مقالات/دسته/پیشگیری', { categoryPublishedCount: 4 })).toEqual({
      index: false,
      follow: true,
    });
    expect(r('/مقالات/دسته/پیشگیری', { categoryPublishedCount: 5 })).toEqual({
      index: true,
      follow: true,
    });
    expect(r('/خدمات/لمینت-سرامیکی', { noindex: true })).toEqual({ index: false, follow: true });
  });
});

describe('robotsTxt (spec 9.5)', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => vi.unstubAllEnvs());

  it('RT1 indexing off: everything disallowed, no sitemap', async () => {
    const { robotsTxt } = await load();
    expect(robotsTxt({ allowIndexing: false, mediaPublicOrigin: null })).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
  });

  it('RT2 indexing on: admin and API blocked, media files allowed, sitemap absolute', async () => {
    const { robotsTxt } = await load();
    expect(robotsTxt({ allowIndexing: true, mediaPublicOrigin: null })).toEqual({
      rules: { userAgent: '*', allow: ['/', '/api/media/file/'], disallow: ['/admin', '/api/'] },
      sitemap: 'https://sefiddental.ir/sitemap.xml',
    });
    expect(
      robotsTxt({ allowIndexing: true, mediaPublicOrigin: 'https://cdn.example.com' }).rules,
    ).toEqual({
      userAgent: '*',
      allow: ['/'],
      disallow: ['/admin', '/api/'],
    });
  });
});
