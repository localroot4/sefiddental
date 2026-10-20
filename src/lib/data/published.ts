import type {
  CollectionSlug,
  DataFromCollectionSlug,
  JoinQuery,
  SelectType,
  TypedCollectionSelect,
  TransformCollectionWithSelect,
  Where,
} from 'payload';

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

/** The link and upload collections of the rich-text editors (src/fields/richText.ts). */
const RICH_TEXT_TARGETS = ['services', 'articles', 'pages', 'doctors', 'media'];

/**
 * Collections whose documents a read at `depth` populates into the result, so the reader also
 * carries their `col:` tags and a change there refreshes it. A rich-text field populates its
 * internal links and uploads (RICH_TEXT_TARGETS), so a linked page's slug change refreshes it.
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
      if (field.type === 'richText') for (const slug of RICH_TEXT_TARGETS) found.add(slug);
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

/** The documents a read returns: whole, or only the `select`ed fields (Payload's own typing). */
export type PublishedDoc<S extends CollectionSlug, T> = [T] extends [never]
  ? DataFromCollectionSlug<S>
  : T extends SelectType
    ? TransformCollectionWithSelect<S, T>
    : DataFromCollectionSlug<S>;

interface PublishedQuery<T> {
  where?: Where;
  sort?: string | string[];
  limit?: number;
  depth?: number;
  joins?: false;
  /** Only these fields: a list keeps its cache entries small (no rich-text bodies). */
  select?: T;
}

/** One page of a paged read, with the counts a pagination needs. */
export interface PublishedPage<D> {
  docs: D[];
  page: number;
  totalPages: number;
  totalDocs: number;
}

/**
 * The paged and the full read share this: the `_status` filter of drafts-enabled collections
 * (spec-data P4) and the cache tags of every collection the depth populates.
 */
async function readPublished<S extends CollectionSlug, T>(
  collection: S,
  query: PublishedQuery<T>,
  page?: number,
): Promise<PublishedPage<PublishedDoc<S, T>>> {
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
  const name = page === undefined ? 'getPublished' : 'getPublishedPage';
  return cachedRead(name, { collection, ...query, depth, page }, tags, async () => {
    const result = await payload.find<S, TypedCollectionSelect[S]>({
      collection,
      where,
      sort: query.sort,
      depth,
      joins: query.joins as JoinQuery<S> | undefined,
      select: query.select as TypedCollectionSelect[S] | undefined,
      ...(query.limit === undefined ? { pagination: false } : { limit: query.limit, page }),
    });
    return {
      docs: result.docs as unknown as PublishedDoc<S, T>[],
      page: result.page ?? 1,
      totalPages: result.totalPages,
      totalDocs: result.totalDocs,
    };
  });
}

/**
 * Published documents through the Local API (access overridden: the public site never uses
 * REST). Drafts-enabled collections get the `_status = published` filter (spec-data P4).
 * Without a `limit` every match is returned. Depth defaults to 0. `joins: false` skips join
 * fields: Payload fills them without the `_status` filter, so a template reads those lists
 * through their own published read instead.
 */
export async function getPublished<S extends CollectionSlug, T = never>(
  collection: S,
  query: PublishedQuery<T> = {},
): Promise<PublishedDoc<S, T>[]> {
  return (await readPublished(collection, query)).docs;
}

/** Page `page` (from 1) of `limit` published documents, with the totals (H3 article lists). */
export function getPublishedPage<S extends CollectionSlug, T = never>(
  collection: S,
  query: PublishedQuery<T> & { limit: number; page: number },
): Promise<PublishedPage<PublishedDoc<S, T>>> {
  return readPublished(collection, query, query.page);
}
