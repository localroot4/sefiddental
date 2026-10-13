import { describe, expect, it } from 'vitest';

import { buildPath, hubPath, isGuideKey, normalizePath, PAGE_KEYS, PAGE_PATHS } from './paths';

describe('normalizePath', () => {
  it.each([
    ['N1 decodes percent escapes', '/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA', '/خدمات'],
    ['N2 Arabic yeh and kaf become Persian', '/كيف', '/کیف'],
    ['N3 drops query and fragment', '/vip?utm_source=x#top', '/vip'],
    ['N4 collapses repeated slashes', '//a///b', '/a/b'],
    ['N5 drops a trailing slash', '/خدمات/', '/خدمات'],
    ['N6 keeps the root', '/', '/'],
    ['N7 lowercases ASCII letters only', '/VIP/Ab', '/vip/ab'],
    ['N8 keeps a malformed escape undecoded (ASCII still lowercased)', '/a%E0%A4%A', '/a%e0%a4%a'],
    ['N9 NFC: alef plus maddah composes', '/آدرس', '/آدرس'],
    ['N10 empty input is the root', '', '/'],
    ['N11 encoded uppercase escape decodes', '/%2D', '/-'],
  ])('%s', (_name, input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it('N12 never throws and is idempotent', () => {
    for (const input of ['/%', '/%%%', '/a%zz', '/خدمات/%D9', ...Object.values(PAGE_PATHS)]) {
      const once = normalizePath(input);
      expect(normalizePath(once)).toBe(once);
    }
  });
});

describe('page paths', () => {
  it('PG1 sixteen keys, every path already normalized', () => {
    expect(PAGE_KEYS).toHaveLength(16);
    for (const key of PAGE_KEYS) expect(normalizePath(PAGE_PATHS[key])).toBe(PAGE_PATHS[key]);
  });

  it('PG2 only the three guides are guide keys', () => {
    expect(PAGE_KEYS.filter(isGuideKey)).toEqual([
      'guide-first-visit',
      'guide-dental-fear',
      'guide-aftercare',
    ]);
    expect(isGuideKey('guide-hub')).toBe(false);
  });
});

describe('buildPath and hubPath (spec-data 6.4, 2.8a)', () => {
  it.each([
    ['B1', 'service-categories', { slug: 'زیبایی' }, '/خدمات/زیبایی'],
    [
      'B2',
      'service-categories',
      { standalone: true, standaloneServiceSlug: 'ارتودنسی' },
      '/خدمات/ارتودنسی',
    ],
    ['B3', 'service-categories', { standalone: true }, null],
    ['B4', 'services', { slug: 'لمینت-سرامیکی' }, '/خدمات/لمینت-سرامیکی'],
    ['B5', 'doctors', { slug: 'دکتر-نام' }, '/پزشکان/دکتر-نام'],
    ['B6', 'articles', { slug: 'مقاله' }, '/مقالات/مقاله'],
    ['B7', 'article-categories', { slug: 'دسته' }, '/مقالات/دسته/دسته'],
    ['B8', 'tags', { slug: 'برچسب' }, '/مقالات/برچسب/برچسب'],
    ['B9', 'pages', { key: 'home' }, '/'],
    ['B10', 'pages', { key: 'booking-success', slug: 'x' }, '/رزرو-نوبت/ثبت-شد'],
    ['B11', 'pages', { key: 'guide-aftercare', slug: 'مراقبت' }, '/راهنمای-بیمار/مراقبت'],
    ['B12', 'pages', { key: 'guide-aftercare' }, '/راهنمای-بیمار/مراقبت-بعد-از-درمان'],
    ['B13', 'pages', { key: 'unknown' }, null],
    ['B14', 'services', { slug: null }, null],
  ] as const)('%s %s', (_id, collection, doc, expected) => {
    expect(buildPath(collection, doc)).toBe(expected);
  });

  it('B15 every page key builds its table 2.8a path', () => {
    for (const key of PAGE_KEYS) expect(buildPath('pages', { key })).toBe(PAGE_PATHS[key]);
  });

  it.each([
    ['service-categories', undefined, '/خدمات'],
    ['services', undefined, '/خدمات'],
    ['doctors', undefined, '/پزشکان'],
    ['articles', undefined, '/مقالات'],
    ['article-categories', undefined, '/مقالات'],
    ['tags', undefined, '/مقالات'],
    ['pages', { key: 'guide-dental-fear' }, '/راهنمای-بیمار'],
    ['pages', { key: 'about' }, '/'],
  ] as const)('H %s goes to its hub', (collection, doc, expected) => {
    expect(hubPath(collection, doc)).toBe(expected);
  });
});
