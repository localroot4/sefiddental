import { getSeoDefaults } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { absoluteUrl } from '@/lib/seo/url';
import { RSS_HEADERS, rssXml, type RssItem } from '@/lib/seo/xml';

export const RSS_ITEM_LIMIT = 20;
const FALLBACK_DESCRIPTION = 'مقالات سلامت دهان و دندان';

/** `/rss.xml` (spec 9.6): the newest published articles; zero items is valid in phase 3. */
export async function rssResponse(): Promise<Response> {
  const [articles, seo] = await Promise.all([
    getPublished('articles', { sort: '-publishedAt', limit: RSS_ITEM_LIMIT }),
    getSeoDefaults(),
  ]);
  const items = articles.flatMap((doc): RssItem[] => {
    const path = buildPath('articles', doc);
    if (path === null) return [];
    const pubDate = doc.publishedAt ?? doc.updatedAt;
    return [{ title: doc.title, link: absoluteUrl(path), description: doc.excerpt, pubDate }];
  });
  const newest = articles
    .map((doc) => doc.updatedAt)
    .sort()
    .at(-1);
  const body = rssXml(
    {
      title: `مقالات ${seo.siteName}`,
      link: absoluteUrl(PAGE_PATHS.articles),
      description: seo.defaultDescription || FALLBACK_DESCRIPTION,
      selfUrl: absoluteUrl('/rss.xml'),
      lastBuildDate: newest ? new Date(newest) : new Date(),
    },
    items,
  );
  return new Response(body, { headers: RSS_HEADERS });
}
