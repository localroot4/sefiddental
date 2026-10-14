// Sitemaps and RSS from seeded data (spec-platform 9.4, 9.6), plus the reserved /api names
// (freeze section 6) read from the sanitized Payload config.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { runSeed } from '@/seed/run';

import { getTestPayload, publishedService, uniqueSlug } from './helpers';

// Before any import reads the environment: this file renders the sitemaps of a public site.
const previousIndexing = vi.hoisted(() => {
  const previous = process.env.ALLOW_INDEXING;
  process.env.ALLOW_INDEXING = 'true';
  return previous;
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const site = (path: string) => new URL(path, process.env.SITE_URL ?? 'http://localhost:3000').href;

describe('sitemaps and RSS after seeding', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    await runSeed(payload, { mode: 'create-only', root: process.cwd() });
  });
  afterAll(() => {
    if (previousIndexing === undefined) delete process.env.ALLOW_INDEXING;
    else process.env.ALLOW_INDEXING = previousIndexing;
  });

  it('PS1 the index names four children; pages.xml has the published, indexable pages', async () => {
    const index = await (await import('@/app/sitemap.xml/route')).GET();
    const indexXml = await index.text();
    expect(locs(indexXml)).toEqual(
      ['pages', 'services', 'doctors', 'articles'].map((n) => site(`/sitemaps/${n}.xml`)),
    );
    const pagesXml = await (await (await import('@/app/sitemaps/pages.xml/route')).GET()).text();
    const pageLocs = locs(pagesXml);
    expect(pageLocs).toContain(site('/'));
    expect(pageLocs).toContain(site('/خدمات'));
    // Never: the noindex booking confirmation and the guide drafts the seeder leaves unpublished.
    expect(pageLocs).not.toContain(site('/رزرو-نوبت/ثبت-شد'));
    const drafts = await payload.find({
      collection: 'pages',
      where: { _status: { equals: 'draft' } },
      depth: 0,
      pagination: false,
    });
    for (const draft of drafts.docs) expect(pageLocs).not.toContain(site(draft.path));
    expect(new Set(pageLocs).size).toBe(pageLocs.length);
  });

  it('PS2 services.xml: every published service once with its updatedAt; a draft is absent', async () => {
    const { service } = await publishedService(payload);
    const draft = await payload.create({
      collection: 'services',
      data: {
        ...service,
        id: undefined,
        key: `draft-${service.key}`,
        slug: uniqueSlug('پیش‌نویس'),
      } as never,
      draft: true,
    });
    const xml = await (await (await import('@/app/sitemaps/services.xml/route')).GET()).text();
    const all = locs(xml);
    const published = await payload.find({
      collection: 'services',
      where: { _status: { equals: 'published' } },
      depth: 0,
      pagination: false,
    });
    for (const doc of published.docs) {
      expect(all.filter((loc) => loc === site(`/خدمات/${doc.slug}`))).toHaveLength(1);
    }
    expect(xml).toContain(
      `<loc>${site(`/خدمات/${service.slug}`)}</loc><lastmod>${new Date(service.updatedAt).toISOString()}</lastmod>`,
    );
    expect(all).not.toContain(site(`/خدمات/${draft.slug}`));
  });

  it('PS3 rss.xml is RSS 2.0 with the Persian channel; doctors and articles sitemaps parse', async () => {
    const rss = await (await import('@/app/rss.xml/route')).GET();
    expect(rss.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
    const xml = await rss.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(xml).toContain('<language>fa-IR</language>');
    for (const name of ['doctors', 'articles'] as const) {
      const route = await import(`@/app/sitemaps/${name}.xml/route`);
      const res = (await route.GET()) as Response;
      expect(res.headers.get('x-robots-tag')).toBe('noindex');
      expect(await res.text()).toContain('<urlset');
    }
  });

  it('PR1 no collection slug and no root endpoint takes a reserved /api name', async () => {
    const reserved = [
      'health',
      'events',
      'csp-report',
      'cron',
      'internal',
      'form-session',
      'preview',
      'booking',
      'emergency',
    ];
    const slugs = payload.config.collections.map((c) => c.slug);
    expect(slugs).toContain('payload-jobs');
    const endpoints = (payload.config.endpoints ?? []).map(
      (e) => e.path.split('/').filter(Boolean)[0] ?? '',
    );
    for (const name of reserved) {
      expect(slugs).not.toContain(name);
      expect(endpoints).not.toContain(name);
    }
  });
});
