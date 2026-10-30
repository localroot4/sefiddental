import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

type Doc = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Doc[]>,
  calls: [] as { collection: string; query: unknown }[],
  seo: { siteName: 'کلینیک دندانپزشکی سفید', defaultDescription: null as string | null },
}));
vi.mock('@/lib/data/published', () => ({
  getPublished: async (collection: string, query: unknown) => {
    mocks.calls.push({ collection, query });
    return mocks.rows[collection] ?? [];
  },
}));
vi.mock('@/lib/data/globals', () => ({ getSeoDefaults: async () => mocks.seo }));

const SITE = 'https://sefiddental.ir';
const enc = (path: string) => new URL(path, SITE).href;

const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T08:30:00.000Z`;

function seed(): void {
  mocks.rows = {
    pages: [
      { key: 'home', updatedAt: at(1) },
      { key: 'services-hub', slug: 'خدمات', updatedAt: at(2) },
      { key: 'articles', updatedAt: at(5) },
      { key: 'dentists-hub', updatedAt: at(5) },
      { key: 'guide-hub', updatedAt: at(5) },
      { key: 'guide-first-visit', slug: 'اولین-مراجعه', updatedAt: at(5) },
      { key: 'cases', updatedAt: at(5) },
      { key: 'booking-success', slug: 'ثبت-شد', updatedAt: at(3) },
      { key: 'privacy', slug: 'حریم-خصوصی', updatedAt: at(4), seo: { noindex: true } },
    ],
    'service-categories': [
      { id: 1, slug: 'زیبایی', updatedAt: at(5) },
      { id: 2, standalone: true, standaloneServiceSlug: 'ارتودنسی', updatedAt: at(6) },
    ],
    services: [{ slug: 'لمینت-سرامیکی', updatedAt: at(7) }],
    doctors: [{ slug: 'دکتر-نمونه', updatedAt: at(8) }],
    // updatedAt moves on every save (a later non-content edit here); the content dates do not.
    articles: [
      ...Array.from({ length: 5 }, (_, i) => ({
        title: `مقاله ${i}`,
        slug: `مقاله-${i}`,
        excerpt: 'خلاصه & <نکته>',
        category: { id: 10 },
        publishedAt: at(10 + i),
        contentUpdatedAt: i === 4 ? at(18) : null,
        updatedAt: at(26),
      })),
      { title: 'تک', slug: 'تک', excerpt: 'x', category: 11, updatedAt: at(9) },
    ],
    'article-categories': [
      { id: 10, slug: 'پر', updatedAt: at(20) },
      { id: 11, slug: 'کم', updatedAt: at(21) },
    ],
  };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('sitemaps (spec 9.4)', () => {
  beforeEach(() => {
    stubSiteEnv({ ALLOW_INDEXING: 'true' });
    mocks.calls = [];
    seed();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('SM1 the index lists the four children with the newest updatedAt of each', async () => {
    const { sitemapIndexResponse } = await import('./sitemaps');
    const res = await sitemapIndexResponse();
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    const xml = await res.text();
    expect(xml).toContain('<sitemapindex');
    expect(locs(xml)).toEqual(
      ['pages', 'services', 'doctors', 'articles'].map((n) => `${SITE}/sitemaps/${n}.xml`),
    );
    expect(xml).toContain(`<loc>${SITE}/sitemaps/articles.xml</loc><lastmod>${at(18)}</lastmod>`);
  });

  it('SM2 pages: indexable published pages only, absolute percent-encoded URLs, lastmod', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('pages')).text();
    expect(locs(xml)).toEqual([
      `${SITE}/`,
      enc('/خدمات'),
      enc('/مقالات'),
      enc('/پزشکان'),
      enc('/راهنمای-بیمار'),
      enc('/راهنمای-بیمار/اولین-مراجعه'),
    ]);
    expect(xml).toContain(`<loc>${enc('/خدمات')}</loc><lastmod>${at(2)}</lastmod>`);
    expect(xml).toContain('%D8%AE%D8%AF%D9%85%D8%A7%D8%AA');
  });

  it('SM3 services: categories with their own page, then services; standalone ones once', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('services')).text();
    expect(locs(xml)).toEqual([enc('/خدمات/زیبایی'), enc('/خدمات/لمینت-سرامیکی')]);
  });

  it('SM4 articles: articles, and categories only from 5 published articles; never tags', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('articles')).text();
    expect(locs(xml)).toContain(enc('/مقالات/دسته/پر'));
    expect(locs(xml)).not.toContain(enc('/مقالات/دسته/کم'));
    expect(locs(xml)).toHaveLength(7);
    expect(xml).not.toContain('برچسب');
    expect(mocks.calls.map((c) => c.collection)).not.toContain('tags');
  });

  it('SM6 articles: lastmod is contentUpdatedAt, else publishedAt (the JSON-LD dateModified), never a later save (H16)', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('articles')).text();
    expect(xml).toContain(`<loc>${enc('/مقالات/مقاله-0')}</loc><lastmod>${at(10)}</lastmod>`);
    expect(xml).toContain(`<loc>${enc('/مقالات/مقاله-4')}</loc><lastmod>${at(18)}</lastmod>`);
    expect(xml).not.toContain(at(26));
  });

  it('SM7 an indexable category takes the lastmod of its newest article, not its own updatedAt', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('articles')).text();
    expect(xml).toContain(`<loc>${enc('/مقالات/دسته/پر')}</loc><lastmod>${at(18)}</lastmod>`);
    expect(xml).not.toContain(at(20));
  });

  it('SM8 the articles hub leaves pages.xml while no article is published (C25)', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    mocks.rows.articles = [];
    const xml = await (await sitemapResponse('pages')).text();
    expect(locs(xml)).not.toContain(enc('/مقالات'));
    expect(locs(xml)).toContain(enc('/پزشکان'));
  });

  it('SM9 the dentists and guides hubs leave pages.xml while they list nothing; no cases page before its route', async () => {
    const { sitemapResponse } = await import('./sitemaps');
    mocks.rows.doctors = [];
    mocks.rows.pages = mocks.rows.pages!.filter((doc) => doc.key !== 'guide-first-visit');
    const xml = await (await sitemapResponse('pages')).text();
    expect(locs(xml)).toEqual([`${SITE}/`, enc('/خدمات'), enc('/مقالات')]);
    expect(xml).not.toContain(enc('/قبل-و-بعد'));
  });

  it('SM5 ALLOW_INDEXING=false: every child is an empty urlset and nothing is read', async () => {
    stubSiteEnv({ ALLOW_INDEXING: 'false' });
    const { sitemapResponse, sitemapIndexResponse } = await import('./sitemaps');
    const xml = await (await sitemapResponse('doctors')).text();
    expect(xml).toMatch(/<urlset xmlns="[^"]+"><\/urlset>/);
    expect(locs(await (await sitemapIndexResponse()).text())).toHaveLength(4);
    expect(mocks.calls).toHaveLength(0);
  });
});

describe('rss.xml (spec 9.6)', () => {
  beforeEach(() => {
    stubSiteEnv();
    seed();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('RS1 channel in Persian with self link; items escaped, RFC 822 dates, newest first', async () => {
    const { rssResponse } = await import('./rss');
    const res = await rssResponse();
    expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
    const xml = await res.text();
    expect(xml).toContain('<title>مقالات کلینیک دندانپزشکی سفید</title>');
    expect(xml).toContain(`<link>${enc('/مقالات')}</link>`);
    expect(xml).toContain('<description>مقالات سلامت دهان و دندان</description>');
    expect(xml).toContain(`<atom:link href="${SITE}/rss.xml" rel="self"`);
    expect(xml).toContain('<description>خلاصه &amp; &lt;نکته&gt;</description>');
    expect(xml).toContain(`<pubDate>${new Date(at(10)).toUTCString()}</pubDate>`);
    // The newest content date of the feed (H16), not a later non-content save.
    expect(xml).toContain(`<lastBuildDate>${new Date(at(18)).toUTCString()}</lastBuildDate>`);
    expect(mocks.calls.at(-1)).toEqual({
      collection: 'articles',
      query: { sort: '-publishedAt', limit: 20 },
    });
  });

  it('RS5 items: guid equals the link, unique, absolute, with an RFC 822 pubDate', async () => {
    const { rssResponse } = await import('./rss');
    const xml = await (await rssResponse()).text();
    const items = [...xml.matchAll(/<item>(.*?)<\/item>/g)].map((m) => m[1]!);
    expect(items).toHaveLength(6);
    const field = (item: string, name: string) =>
      new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(item)?.[1];
    const links = items.map((item) => field(item, 'link'));
    expect(items.map((item) => field(item, 'guid'))).toEqual(links);
    expect(new Set(links).size).toBe(links.length);
    for (const link of links) expect(link).toMatch(/^https:\/\/sefiddental\.ir\/%D9%85/);
    for (const item of items) {
      expect(field(item, 'pubDate')).toMatch(
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
      );
    }
  });

  it('RS2 zero articles is a valid feed; the default description wins when set', async () => {
    mocks.rows = {};
    mocks.seo.defaultDescription = 'توضیح پیش‌فرض';
    const { rssResponse } = await import('./rss');
    const xml = await (await rssResponse()).text();
    expect(xml).not.toContain('<item>');
    expect(xml).toContain('<description>توضیح پیش‌فرض</description>');
    mocks.seo.defaultDescription = null;
  });
});
