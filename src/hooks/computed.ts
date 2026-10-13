import type { CollectionBeforeChangeHook } from 'payload';

import { readingMinutes } from '@/fields/validators';
import { buildPath, isGuideKey, PAGE_PATHS, type PageKey } from '@/lib/paths';

/** H-READTIME and H-PUBDATE (spec-data 6.8) for articles. */
export const articleComputed: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const out = { ...data };
  if (out.body !== undefined) out.readingTime = readingMinutes(out.body);
  if (out._status === 'published' && !out.publishedAt && !originalDoc?.publishedAt) {
    out.publishedAt = new Date().toISOString();
  }
  return out;
};

/**
 * H-PATHCOMPUTE (spec-data 2.8): `path` from the key and slug. Hub and system page slugs are
 * fixed by the route tree; only guide slugs are editable.
 */
export const pagePath: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const key = (data.key ?? originalDoc?.key) as string | undefined;
  if (!key || !(key in PAGE_PATHS)) return data;
  const out = { ...data };
  if (!isGuideKey(key)) {
    const fixed = PAGE_PATHS[key as PageKey];
    out.slug = fixed === '/' ? null : (fixed.split('/').pop() ?? null);
  }
  out.path = buildPath('pages', { key, slug: (out.slug ?? originalDoc?.slug) as string | null });
  return out;
};
