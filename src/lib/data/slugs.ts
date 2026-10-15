import type { CollectionSlug, Where } from 'payload';

import type { DynamicRouteKey } from '@/lib/http/proxyRules';
import { isGuideKey, normalizePath, PAGE_KEYS } from '@/lib/paths';

import { getPayloadClient } from './payload';

const GUIDE_KEYS = PAGE_KEYS.filter(isGuideKey);

/**
 * Published slugs per Persian dynamic route (proxyRules), in the proxy's normalizePath form, for
 * its unknown-slug 404 (decision F10). Read fresh, not through cachedRead: content tags revalidate
 * with the 'max' profile, whose first read after a save is still the old set, and the proxy would
 * then 404 a just-published slug. The proxy memoizes the answer and bounds the refreshes.
 */
export async function getPublishedSlugs(): Promise<Record<DynamicRouteKey, string[]>> {
  const payload = await getPayloadClient();
  const slugsOf = async (collection: CollectionSlug, where?: Where): Promise<string[]> => {
    const published: Where = { _status: { equals: 'published' } };
    const drafts = Boolean(payload.collections[collection].config.versions?.drafts);
    const filter = drafts ? (where ? { and: [where, published] } : published) : where;
    const { docs } = await payload.find({
      collection,
      where: filter,
      depth: 0,
      pagination: false,
      select:
        collection === 'service-categories' ? { slug: true, standalone: true } : { slug: true },
    });
    // A standalone category has no page of its own: its URL is its service's.
    return (docs as { slug?: string | null; standalone?: boolean | null }[]).flatMap((doc) =>
      doc.slug && !doc.standalone ? [normalizePath(`/${doc.slug}`).slice(1)] : [],
    );
  };
  const [services, categories, doctors, guides, articles, articleCategories, tags] =
    await Promise.all([
      slugsOf('services'),
      slugsOf('service-categories'),
      slugsOf('doctors'),
      slugsOf('pages', { key: { in: GUIDE_KEYS } }),
      slugsOf('articles'),
      slugsOf('article-categories'),
      slugsOf('tags'),
    ]);
  return {
    services: [...services, ...categories],
    doctors,
    guides,
    articles,
    'article-categories': articleCategories,
    tags,
  };
}
