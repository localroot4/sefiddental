import { afterEach, describe, expect, it, vi } from 'vitest';

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
      images: [{ url: 'https://sefiddental.ir/brand/og-preview.png', width: 1200, height: 630 }],
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
