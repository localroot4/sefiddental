import { readdirSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OG_CARDS, type OgCard } from '@/i18n/fa-seo';
import { stubSiteEnv } from '@/lib/http/testEnv';
import type { SeoDefaults } from '@/lib/seo/metadata';

const SEO: SeoDefaults = {
  siteName: 'کلینیک دندانپزشکی سفید',
  titleSuffix: ' | کلینیک دندانپزشکی سفید',
  shortTitleSuffix: ' | کلینیک سفید',
  defaultDescription: 'توضیح پیش‌فرض',
};

async function load(indexing: boolean) {
  stubSiteEnv({ ALLOW_INDEXING: String(indexing) });
  return import('@/lib/seo/metadata');
}

describe('buildSiteMetadata (spec 9.2)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('MD1 root: metadataBase, title template, icons, OG fallback image, robots off on staging', async () => {
    const { buildSiteMetadata } = await load(false);
    const m = buildSiteMetadata(SEO);
    expect(String(m.metadataBase)).toBe('https://sefiddental.ir/');
    expect(m.title).toEqual({
      template: '%s | کلینیک دندانپزشکی سفید',
      default: 'کلینیک دندانپزشکی سفید',
    });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(m.icons)).toContain('/brand/favicon.svg');
    expect(m.openGraph).toMatchObject({
      locale: 'fa_IR',
      images: [{ url: 'https://sefiddental.ir/brand/og/default.png', width: 1200, height: 630 }],
    });
    expect(m.verification).toBeUndefined();
  });

  it('MD2 Search Console token when set; robots on in production indexing', async () => {
    const { buildSiteMetadata } = await load(true);
    const m = buildSiteMetadata({ ...SEO, gscVerification: 'token123' });
    expect(m.verification).toEqual({ google: 'token123' });
    expect(m.robots).toEqual({ index: true, follow: true });
  });
});

describe('buildMetadata (spec 9.2)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('MD3 content page: topic title (template adds the suffix), canonical, complete OG and Twitter', async () => {
    const { buildMetadata } = await load(true);
    const m = buildMetadata(
      {
        path: '/خدمات/لمینت-سرامیکی',
        searchParams: { utm_source: 'x' },
        title: 'لمینت سرامیکی',
        kind: 'page',
      },
      SEO,
    );
    const canonical = new URL('/خدمات/لمینت-سرامیکی', 'https://sefiddental.ir').href;
    expect(m.title).toBe('لمینت سرامیکی');
    expect(m.alternates?.canonical).toBe(canonical);
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.description).toBe('توضیح پیش‌فرض');
    expect(m.openGraph).toMatchObject({
      type: 'website',
      locale: 'fa_IR',
      siteName: 'کلینیک دندانپزشکی سفید',
      url: canonical,
      title: 'لمینت سرامیکی | کلینیک دندانپزشکی سفید',
      description: 'توضیح پیش‌فرض',
    });
    expect(m.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'لمینت سرامیکی | کلینیک دندانپزشکی سفید',
    });
  });

  it('MD4 home and dentist titles are absolute', async () => {
    const { buildMetadata, HOME_TITLE } = await load(true);
    expect(buildMetadata({ path: '/', title: 'خانه', kind: 'home' }, SEO).title).toEqual({
      absolute: HOME_TITLE,
    });
    expect(
      buildMetadata({ path: '/پزشکان/دکتر-نمونه', title: 'دکتر نمونه', kind: 'dentist' }, SEO)
        .title,
    ).toEqual({
      absolute: 'دکتر نمونه | کلینیک سفید',
    });
  });

  it('MD8 home with a seo topic keeps the brand first (C7); its OG and Twitter titles match', async () => {
    const { buildMetadata, HOME_TITLE } = await load(true);
    const m = buildMetadata(
      { path: '/', title: 'کلینیک', kind: 'home', seo: { title: 'دندانپزشکی دیجیتال جنوب تهران' } },
      SEO,
    );
    expect(m.title).toEqual({ absolute: HOME_TITLE });
    expect(m.openGraph).toMatchObject({ title: HOME_TITLE, url: 'https://sefiddental.ir/' });
    expect(m.twitter).toMatchObject({ title: HOME_TITLE });
    expect(m.alternates?.canonical).toBe('https://sefiddental.ir/');
  });

  it('MD5 seo fields win; noindex honored; staging forces noindex', async () => {
    const meta = await load(true);
    const m = meta.buildMetadata(
      {
        path: '/خدمات/ایمپلنت',
        title: 'ایمپلنت',
        kind: 'page',
        seo: { title: 'ایمپلنت دندان', description: 'توضیح سئو', noindex: true },
      },
      SEO,
    );
    expect(m.title).toBe('ایمپلنت دندان');
    expect(m.description).toBe('توضیح سئو');
    expect(m.robots).toEqual({ index: false, follow: true });
    const staging = await load(false);
    expect(staging.buildMetadata({ path: '/', title: 'خانه', kind: 'home' }, SEO).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('MD6 article: OG type article with dates and the RSS alternate', async () => {
    const { buildMetadata } = await load(true);
    const m = buildMetadata(
      {
        path: '/مقالات/مراقبت-بعد-از-کشیدن-دندان',
        title: 'مراقبت بعد از کشیدن دندان',
        kind: 'article',
        publishedAt: '2026-10-01T08:00:00.000Z',
        modifiedAt: '2026-10-05T08:00:00.000Z',
        image: { url: '/api/media/file/a.webp', width: 1200, height: 630, alt: 'تصویر' },
      },
      SEO,
    );
    expect(m.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-10-01T08:00:00.000Z',
      modifiedTime: '2026-10-05T08:00:00.000Z',
      images: [{ url: 'https://sefiddental.ir/api/media/file/a.webp', alt: 'تصویر' }],
    });
    expect(m.alternates?.types).toEqual({
      'application/rss+xml': 'https://sefiddental.ir/rss.xml',
    });
  });

  it('MD7 system pages: noindex, no canonical', async () => {
    const { buildMetadata } = await load(true);
    const m = buildMetadata({ path: '/qa/not-found', title: 'صفحه پیدا نشد', kind: 'system' }, SEO);
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBeUndefined();
    expect(m.openGraph).not.toHaveProperty('url');
  });
});

describe('article lists and share cards (phase 6: H3, H4, H14, C16, C25)', () => {
  afterEach(() => vi.unstubAllEnvs());
  const enc = (p: string) => new URL(p, 'https://sefiddental.ir').href;

  it('MD9 category: «{نام دسته} | مقالات کلینیک…», page N in Persian digits, self-canonical, noindex below 5', async () => {
    const { buildMetadata } = await load(true);
    const base = {
      path: '/مقالات/دسته/پیشگیری',
      title: 'پیشگیری',
      kind: 'articleCategory' as const,
      listCount: 5,
    };
    const first = buildMetadata(base, SEO);
    expect(first.title).toEqual({ absolute: 'پیشگیری | مقالات کلینیک دندانپزشکی سفید' });
    expect(first.robots).toEqual({ index: true, follow: true });
    expect(first.alternates?.canonical).toBe(enc('/مقالات/دسته/پیشگیری'));

    const second = buildMetadata({ ...base, page: 2, searchParams: { page: '۲' } }, SEO);
    const title = 'پیشگیری، صفحهٔ ۲ | مقالات کلینیک دندانپزشکی سفید';
    expect(second.title).toEqual({ absolute: title });
    expect(second.openGraph).toMatchObject({ title, url: `${enc(base.path)}?page=2` });
    expect(second.twitter).toMatchObject({ title });
    expect(second.alternates?.canonical).toBe(`${enc(base.path)}?page=2`);

    expect(buildMetadata({ ...base, listCount: 4 }, SEO).robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it('MD10 hub and tag pages: page suffix, canonical from the page, hub noindex while empty, tag always', async () => {
    const { buildMetadata } = await load(true);
    const hub = buildMetadata(
      {
        path: '/مقالات',
        title: 'مقالات سلامت دهان و دندان',
        kind: 'articles',
        page: 3,
        listCount: 30,
      },
      SEO,
    );
    expect(hub.title).toBe('مقالات سلامت دهان و دندان، صفحهٔ ۳');
    expect(hub.openGraph).toMatchObject({
      title: 'مقالات سلامت دهان و دندان، صفحهٔ ۳ | کلینیک دندانپزشکی سفید',
    });
    expect(hub.alternates?.canonical).toBe(`${enc('/مقالات')}?page=3`);
    expect(hub.alternates?.types).toEqual({
      'application/rss+xml': 'https://sefiddental.ir/rss.xml',
    });
    expect(hub.robots).toEqual({ index: true, follow: true });
    const empty = buildMetadata(
      { path: '/مقالات', title: 'مقالات', kind: 'articles', listCount: 0 },
      SEO,
    );
    expect(empty.robots).toEqual({ index: false, follow: true });
    expect(empty.title).toBe('مقالات');

    const tag = buildMetadata(
      { path: '/مقالات/برچسب/ایمپلنت', title: 'ایمپلنت', kind: 'tag', page: 2, listCount: 40 },
      SEO,
    );
    expect(tag.title).toEqual({
      absolute: 'ایمپلنت، صفحهٔ ۲ | مقالات کلینیک دندانپزشکی سفید',
    });
    expect(tag.robots).toEqual({ index: false, follow: true });
    expect(tag.alternates?.canonical).toBe(`${enc('/مقالات/برچسب/ایمپلنت')}?page=2`);
  });

  it('MD11 without an image every page type shares its 1200x630 card; the global default replaces only the default card', async () => {
    const { buildMetadata } = await load(true);
    const cards: Array<[string, OgCard]> = [
      ['/', 'default'],
      ['/خدمات', 'services-hub'],
      ['/خدمات/لمینت-سرامیکی', 'service'],
      ['/مقالات', 'articles'],
      ['/مقالات/دسته/پیشگیری', 'articles'],
      ['/مقالات/برچسب/ایمپلنت', 'articles'],
      ['/مقالات/مراقبت-بعد-از-کشیدن-دندان', 'article'],
      ['/راهنمای-بیمار', 'guide-hub'],
      ['/راهنمای-بیمار/اولین-مراجعه', 'guide'],
      ['/پزشکان', 'dentists-hub'],
      ['/پزشکان/دکتر-نمونه', 'dentist'],
      ['/هزینه-و-پرداخت', 'pricing'],
      ['/قبل-و-بعد', 'cases'],
      ['/درباره-ما', 'about'],
      ['/آدرس', 'address'],
      ['/اورژانس', 'emergency'],
      ['/رزرو-نوبت', 'default'],
      ['/حریم-خصوصی', 'default'],
    ];
    for (const [path, card] of cards) {
      const m = buildMetadata({ path, title: 'عنوان', kind: 'page' }, SEO);
      expect(m.openGraph?.images, path).toEqual([
        {
          url: `https://sefiddental.ir/brand/og/${card}.png`,
          width: 1200,
          height: 630,
          alt: expect.any(String),
        },
      ]);
      expect(m.twitter?.images, path).toEqual([`https://sefiddental.ir/brand/og/${card}.png`]);
    }
    // A service category shares the path shape of a service: its route names the card.
    const category = buildMetadata(
      { path: '/خدمات/زیبایی', title: 'زیبایی', kind: 'page', card: 'service-category' },
      SEO,
    );
    expect(category.openGraph?.images).toMatchObject([
      { url: 'https://sefiddental.ir/brand/og/service-category.png', alt: 'خدمات کلینیک سفید' },
    ]);

    const fallback = { url: '/api/media/file/og-1-1200x630.jpg', width: 1200, height: 630 };
    const withDefault = { ...SEO, defaultOgImage: fallback };
    expect(
      buildMetadata({ path: '/حریم-خصوصی', title: 'حریم خصوصی', kind: 'page' }, withDefault)
        .openGraph?.images,
    ).toMatchObject([{ url: `https://sefiddental.ir${fallback.url}` }]);
    expect(
      buildMetadata({ path: '/اورژانس', title: 'اورژانس', kind: 'page' }, withDefault).openGraph
        ?.images,
    ).toMatchObject([{ url: 'https://sefiddental.ir/brand/og/emergency.png' }]);
    // A document image always wins over the card.
    expect(
      buildMetadata(
        { path: '/اورژانس', title: 'اورژانس', kind: 'page', image: fallback },
        withDefault,
      ).openGraph?.images,
    ).toMatchObject([{ url: `https://sefiddental.ir${fallback.url}` }]);
  });

  it('MD12 every card is a committed 1200x630 PNG in design/brand/og, and no other file is there', async () => {
    const dir = path.join(process.cwd(), 'design', 'brand', 'og');
    expect(readdirSync(dir).sort()).toEqual(OG_CARDS.map((card) => `${card}.png`).sort());
    for (const card of OG_CARDS) {
      const meta = await sharp(path.join(dir, `${card}.png`)).metadata();
      expect([meta.format, meta.width, meta.height], card).toEqual(['png', 1200, 630]);
    }
  });
});
