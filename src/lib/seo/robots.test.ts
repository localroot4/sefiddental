import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';
import { ADMIN_ROUTE } from '@/lib/paths';

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
    expect(canonicalUrl('/خدمات/لمینت-سرامیکی', { page: '2' })).toBe(LAMINATE);
  });

  it('CU3 page values that are not integers of 2 or more are dropped', async () => {
    const { canonicalUrl } = await load();
    for (const page of ['0', '1', '-2', '2.5', 'abc', '']) {
      expect(canonicalUrl('/مقالات', { page })).not.toContain('?');
    }
    expect(canonicalUrl('/مقالات', { page: '007' })).toMatch(/\?page=7$/);
  });

  it('CU4 tag lists paginate too (H3); Persian and Arabic-Indic digits canonicalize to ASCII', async () => {
    const { canonicalUrl } = await load();
    expect(canonicalUrl('/مقالات/برچسب/ایمپلنت', { page: '2' })).toMatch(/\?page=2$/);
    expect(canonicalUrl('/مقالات', { page: '۲' })).toMatch(/\?page=2$/);
    expect(canonicalUrl('/مقالات/دسته/پیشگیری', { page: '٣' })).toMatch(/\?page=3$/);
    expect(canonicalUrl('/مقالات', { page: ['4', '5'] })).toMatch(/\?page=4$/);
  });
});

describe('parsePageParam (H3)', () => {
  it('PP1 integers of 2 or more in ASCII, Persian or Arabic-Indic digits; null for the rest', async () => {
    const { parsePageParam } = await load();
    expect(parsePageParam('2')).toBe(2);
    expect(parsePageParam('۲')).toBe(2);
    expect(parsePageParam('٣')).toBe(3);
    expect(parsePageParam('۱۲')).toBe(12);
    expect(parsePageParam('010')).toBe(10);
    expect(parsePageParam(['3', '9'])).toBe(3);
    for (const raw of [
      undefined,
      null,
      '',
      '0',
      '1',
      '۱',
      '-2',
      '+2',
      '2.5',
      '۲٫۵',
      'abc',
      ' 2',
      '2 ',
    ]) {
      expect(parsePageParam(raw), String(raw)).toBeNull();
    }
    // Past Number.MAX_SAFE_INTEGER the value is no longer exact: malformed, not a page.
    expect(parsePageParam('9'.repeat(20))).toBeNull();
    expect(parsePageParam(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
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
    const r = (path: string, extra: { noindex?: boolean; listCount?: number } = {}) =>
      pageRobots({ path, allowIndexing: true, ...extra });
    expect(r('/')).toEqual({ index: true, follow: true });
    expect(r('/رزرو-نوبت')).toEqual({ index: true, follow: true });
    expect(r('/رزرو-نوبت/ثبت-شد')).toEqual({ index: false, follow: true });
    expect(r('/مقالات/برچسب/ایمپلنت')).toEqual({ index: false, follow: true });
    expect(r('/مقالات/دسته/پیشگیری', { listCount: 4 })).toEqual({
      index: false,
      follow: true,
    });
    expect(r('/مقالات/دسته/پیشگیری', { listCount: 5 })).toEqual({
      index: true,
      follow: true,
    });
    expect(r('/خدمات/لمینت-سرامیکی', { noindex: true })).toEqual({ index: false, follow: true });
  });

  it('RB3 article lists by published count: the hub from 1 (C25), a category from 5 (H4)', async () => {
    const { pageRobots } = await load();
    const r = (path: string, listCount?: number) =>
      pageRobots({ path, allowIndexing: true, listCount });
    const noindex = { index: false, follow: true };
    const index = { index: true, follow: true };
    expect(r('/مقالات', 0)).toEqual(noindex);
    expect(r('/مقالات')).toEqual(noindex);
    expect(r('/مقالات', 1)).toEqual(index);
    expect(r('/مقالات/دسته/پیشگیری')).toEqual(noindex);
    expect(r('/مقالات/دسته/پیشگیری', 4)).toEqual(noindex);
    expect(r('/مقالات/دسته/پیشگیری', 5)).toEqual(index);
    expect(r('/مقالات/برچسب/ایمپلنت', 40)).toEqual(noindex);
    // The dentists and guides hubs list published documents too: noindex while empty.
    for (const hub of ['/پزشکان', '/راهنمای-بیمار']) {
      expect(r(hub), hub).toEqual(noindex);
      expect(r(hub, 0), hub).toEqual(noindex);
      expect(r(hub, 1), hub).toEqual(index);
    }
    // An article itself is not a list: no count, indexable.
    expect(r('/مقالات/مراقبت-بعد-از-کشیدن-دندان')).toEqual(index);
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

  it('RT2 indexing on: API blocked, media files allowed, sitemap absolute, no admin path', async () => {
    const { robotsTxt } = await load();
    const on = robotsTxt({ allowIndexing: true, mediaPublicOrigin: null });
    expect(on).toEqual({
      rules: { userAgent: '*', allow: ['/', '/api/media/file/'], disallow: ['/api/'] },
      sitemap: 'https://sefiddental.ir/sitemap.xml',
    });
    expect(
      robotsTxt({ allowIndexing: true, mediaPublicOrigin: 'https://cdn.example.com' }).rules,
    ).toEqual({
      userAgent: '*',
      allow: ['/'],
      disallow: ['/api/'],
    });
    // The admin answers X-Robots-Tag noindex; naming it in a public file would reveal it.
    for (const path of [ADMIN_ROUTE, '/admin']) expect(JSON.stringify(on)).not.toContain(path);
  });
});
