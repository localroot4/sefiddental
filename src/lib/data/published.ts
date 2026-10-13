import type { CollectionSlug, DataFromCollectionSlug, Where } from 'payload';

import { cachedRead } from './cache';
import { getPayloadClient } from './payload';
import { colTag } from './tags';

interface FieldLike {
  readonly type: string;
  readonly relationTo?: string | readonly string[];
  readonly collection?: string | readonly string[];
  readonly fields?: readonly FieldLike[];
  readonly tabs?: readonly { readonly fields: readonly FieldLike[] }[];
  readonly blocks?: readonly { readonly fields: readonly FieldLike[] }[];
}

/**
 * Collections whose documents a read at `depth` populates into the result, so the reader also
 * carries their `col:` tags and a change there refreshes it.
 * shortcut: rich-text link and upload nodes are not followed; add them when a template renders
 * populated rich text (phase 6).
 */
export function populatedCollections(
  fields: readonly FieldLike[],
  depth: number,
  fieldsOf: (slug: string) => readonly FieldLike[] | undefined,
): string[] {
  const found = new Set<string>();
  const walk = (list: readonly FieldLike[], level: number): void => {
    for (const field of list) {
      const targets = field.relationTo ?? (field.type === 'join' ? field.collection : undefined);
      if (targets && ['relationship', 'upload', 'join'].includes(field.type)) {
        for (const slug of [targets].flat()) {
          if (found.has(slug)) continue;
          found.add(slug);
          const next = level > 1 ? fieldsOf(slug) : undefined;
          if (next) walk(next, level - 1);
        }
      }
      if (field.fields) walk(field.fields, level);
      for (const tab of field.tabs ?? []) walk(tab.fields, level);
      for (const block of field.blocks ?? []) walk(block.fields, level);
    }
  };
  if (depth > 0) walk(fields, depth);
  return [...found].sort();
}

/**
 * Published documents through the Local API (access overridden: the public site never uses
 * REST). Drafts-enabled collections get the `_status = published` filter (spec-data P4).
 * Without a `limit` every match is returned. Depth defaults to 0.
 */
export async function getPublished<S extends CollectionSlug>(
  collection: S,
  query: { where?: Where; sort?: string | string[]; limit?: number; depth?: number } = {},
): Promise<DataFromCollectionSlug<S>[]> {
  const payload = await getPayloadClient();
  const config = payload.collections[collection].config;
  const depth = query.depth ?? 0;
  const fieldsOf = (slug: string) =>
    payload.collections[slug as CollectionSlug]?.config.fields as FieldLike[] | undefined;
  const tags = [collection, ...populatedCollections(config.fields as FieldLike[], depth, fieldsOf)]
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .map(colTag);
  const published: Where = { _status: { equals: 'published' } };
  const where = config.versions?.drafts
    ? query.where
      ? { and: [query.where, published] }
      : published
    : query.where;
  return cachedRead('getPublished', { collection, ...query, depth }, tags, async () => {
    const result = await payload.find({
      collection,
      where,
      sort: query.sort,
      depth,
      ...(query.limit === undefined ? { pagination: false } : { limit: query.limit }),
    });
    return result.docs as DataFromCollectionSlug<S>[];
  });
}
