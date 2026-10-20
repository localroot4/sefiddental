import { getPublished } from '@/lib/data/published';
import { readEnv } from '@/lib/env';
import { buildPath, type PathCollection } from '@/lib/paths';
import { pageRobots } from '@/lib/seo/robots';
import { absoluteUrl } from '@/lib/seo/url';
import { type SitemapEntry, SITEMAP_HEADERS, sitemapIndexXml, urlsetXml } from '@/lib/seo/xml';

/*
 * Sitemap index plus one sitemap per collection group (spec 9.4). Published documents only,
 * read through the tagged readers, so a publish refreshes the files. A URL appears once: the hub
 * pages (services, dentists, articles) live in pages.xml. lastmod is `updatedAt`, except articles
 * and their categories (H16): `updatedAt` moves on every save, an article's content date does not.
 */

export const SITEMAP_NAMES = ['pages', 'services', 'doctors', 'articles'] as const;
export type SitemapName = (typeof SITEMAP_NAMES)[number];

interface Indexable {
  slug?: string | null;
  key?: string | null;
  standalone?: boolean | null;
  updatedAt?: string | null;
  seo?: { noindex?: boolean | null } | null;
}

/**
 * One entry when the document has a public path and its robots rule allows indexing. Article
 * lists pass their published article count; `lastmod` defaults to the document's `updatedAt`.
 */
function entry(
  collection: PathCollection,
  doc: Indexable,
  list: { articleCount?: number; lastmod?: string | null } = {},
): SitemapEntry[] {
  const path = buildPath(collection, doc);
  if (path === null) return [];
  const robots = pageRobots({
    path,
    allowIndexing: true,
    noindex: doc.seo?.noindex,
    articleCount: list.articleCount,
  });
  return robots.index ? [{ loc: absoluteUrl(path), lastmod: list.lastmod ?? doc.updatedAt }] : [];
}

/** An article's content date: the JSON-LD dateModified of its page (H16). */
export const articleLastmod = (doc: {
  contentUpdatedAt?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}) => doc.contentUpdatedAt ?? doc.publishedAt ?? doc.updatedAt;

const idOf = (value: number | { id: number } | null | undefined) =>
  typeof value === 'object' && value !== null ? value.id : value;

const LOADERS: Record<SitemapName, () => Promise<SitemapEntry[]>> = {
  async pages() {
    const [pages, articles] = await Promise.all([
      getPublished('pages', { sort: 'path' }),
      getPublished('articles', { limit: 1 }),
    ]);
    // The articles hub is noindex while empty (C25); the count matters to that page only.
    return pages.flatMap((doc) => entry('pages', doc, { articleCount: articles.length }));
  },
  async services() {
    const [categories, services] = await Promise.all([
      getPublished('service-categories', { sort: 'slug' }),
      getPublished('services', { sort: 'slug' }),
    ]);
    // A standalone category resolves to its service's URL, which services already list.
    return [
      ...categories
        .filter((doc) => !doc.standalone)
        .flatMap((doc) => entry('service-categories', doc)),
      ...services.flatMap((doc) => entry('services', doc)),
    ];
  },
  async doctors() {
    const doctors = await getPublished('doctors', { sort: 'slug' });
    return doctors.flatMap((doc) => entry('doctors', doc));
  },
  async articles() {
    const [articles, categories] = await Promise.all([
      getPublished('articles', { sort: '-publishedAt' }),
      getPublished('article-categories', { sort: 'slug' }),
    ]);
    const perCategory = new Map<number | null | undefined, { count: number; lastmod: string }>();
    for (const article of articles) {
      const id = idOf(article.category);
      const lastmod = new Date(articleLastmod(article)).toISOString();
      const seen = perCategory.get(id);
      perCategory.set(id, {
        count: (seen?.count ?? 0) + 1,
        lastmod: seen && seen.lastmod > lastmod ? seen.lastmod : lastmod,
      });
    }
    // Categories enter at 5 published articles (ia.md 51) with their newest article's date; tags
    // never do.
    return [
      ...articles.flatMap((doc) => entry('articles', doc, { lastmod: articleLastmod(doc) })),
      ...categories.flatMap((doc) => {
        const list = perCategory.get(doc.id);
        return entry('article-categories', doc, {
          articleCount: list?.count ?? 0,
          lastmod: list?.lastmod,
        });
      }),
    ];
  },
};

/** Entries of one child sitemap; empty while ALLOW_INDEXING is off (staging). */
export async function sitemapEntries(name: SitemapName): Promise<SitemapEntry[]> {
  if (!readEnv().allowIndexing) return [];
  return LOADERS[name]();
}

const newest = (entries: readonly SitemapEntry[]): string | null =>
  entries.reduce<string | null>((max, e) => {
    const value = e.lastmod ? new Date(e.lastmod).toISOString() : null;
    return value !== null && (max === null || value > max) ? value : max;
  }, null);

const xmlResponse = (body: string) => new Response(body, { headers: SITEMAP_HEADERS });

/** `/sitemap.xml`: the four children, each with the newest `updatedAt` it lists. */
export async function sitemapIndexResponse(): Promise<Response> {
  const children = await Promise.all(
    SITEMAP_NAMES.map(async (name) => ({
      loc: absoluteUrl(`/sitemaps/${name}.xml`),
      lastmod: newest(await sitemapEntries(name)),
    })),
  );
  return xmlResponse(sitemapIndexXml(children));
}

/** `/sitemaps/<name>.xml`. */
export async function sitemapResponse(name: SitemapName): Promise<Response> {
  return xmlResponse(urlsetXml(await sitemapEntries(name)));
}
