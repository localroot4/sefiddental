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
  // H4: a category or tag without a published article has no page, so its slug answers the 404.
  const used = await payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    depth: 0,
    pagination: false,
    select: { category: true, tags: true },
  });
  const idOf = (value: number | { id: number }) => (typeof value === 'object' ? value.id : value);
  // A deleted category leaves its articles with none (ON DELETE SET NULL).
  const categoryIds = [
    ...new Set(used.docs.flatMap((doc) => (doc.category == null ? [] : [idOf(doc.category)]))),
  ];
  const tagIds = [...new Set(used.docs.flatMap((doc) => (doc.tags ?? []).map(idOf)))];
  const usedOnly = async (collection: CollectionSlug, ids: number[]) =>
    ids.length > 0 ? slugsOf(collection, { id: { in: ids } }) : [];
  const [services, categories, doctors, guides, articles, articleCategories, tags] =
    await Promise.all([
      slugsOf('services'),
      slugsOf('service-categories'),
      slugsOf('doctors'),
      slugsOf('pages', { key: { in: GUIDE_KEYS } }),
      slugsOf('articles'),
      usedOnly('article-categories', categoryIds),
      usedOnly('tags', tagIds),
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
