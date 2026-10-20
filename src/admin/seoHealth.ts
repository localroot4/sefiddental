import type { CollectionSlug, Field, Payload } from 'payload';

import {
  descriptionRule,
  effectiveTitleRule,
  type SuffixKey,
  SUFFIXES,
  topicOf,
} from '@/fields/validators';

/**
 * The dashboard's «سلامت سئو» (H23, H33): published, indexable documents whose Google result or
 * byline needs a fix, by the same rules as the publish gate. Tags never index (H4) and article
 * categories index only from five articles, so neither is checked.
 */
export const SEO_COLLECTIONS = ['articles', 'pages', 'services', 'service-categories', 'doctors'];

export type SeoRule = 'title' | 'description' | 'byline';
export const SEO_RULES: readonly SeoRule[] = ['title', 'description', 'byline'];

export interface SeoSpec {
  topic: readonly string[];
  suffix: SuffixKey;
}

export interface SeoHealthItem {
  collection: string;
  id: number | string;
  title: string;
  href: string;
}

export type SeoHealthReport = Record<SeoRule, SeoHealthItem[]>;

type Doc = Record<string, unknown>;

/** The title templates and suffix the SERP preview of this collection uses (seoGroup). */
export function seoSpecOf(fields: readonly Field[]): SeoSpec {
  const seo = fields.find((f) => 'name' in f && f.name === 'seo') as
    { fields?: Field[] } | undefined;
  const preview = seo?.fields?.find((f) => 'name' in f && f.name === 'serpPreview') as
    { admin?: { components?: { Field?: { clientProps?: Partial<SeoSpec> } } } } | undefined;
  const props = preview?.admin?.components?.Field?.clientProps;
  return { topic: props?.topic ?? ['{title}'], suffix: props?.suffix ?? 'titleSuffix' };
}

const idOf = (value: unknown): string | null => {
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value;
  return id === null || id === undefined || id === '' ? null : String(id);
};

/** The rules one published document breaks. */
export function seoProblems(
  collection: string,
  doc: Doc,
  spec: SeoSpec,
  publishedDoctors: ReadonlySet<string>,
): SeoRule[] {
  const seo = (doc.seo ?? {}) as {
    title?: string | null;
    description?: string | null;
    noindex?: boolean;
  };
  if (seo.noindex) return [];
  const problems: SeoRule[] = [];
  if (effectiveTitleRule(seo.title, topicOf(spec.topic, doc), SUFFIXES[spec.suffix]) !== true) {
    problems.push('title');
  }
  if (descriptionRule(seo.description, collection === 'articles') !== true) {
    problems.push('description');
  }
  const people = collection === 'articles' ? [doc.authorDoctor, doc.reviewer].map(idOf) : [];
  if (people.some((id) => id !== null && !publishedDoctors.has(id))) problems.push('byline');
  return problems;
}

/**
 * Reads the published documents of the SEO collections the viewer sees (editors: articles), with
 * access overridden: the caller checks the TOTP-verified staff user first.
 */
export async function loadSeoHealth(
  payload: Payload,
  visible: readonly string[],
): Promise<SeoHealthReport> {
  const report: SeoHealthReport = { title: [], description: [], byline: [] };
  const read = SEO_COLLECTIONS.filter((slug) => visible.includes(slug));
  const found = new Map<string, Doc[]>();
  for (const collection of read) {
    const config = payload.collections[collection as CollectionSlug].config;
    const docs = await payload.find({
      collection: collection as CollectionSlug,
      ...(config.versions?.drafts ? { where: { _status: { equals: 'published' } } } : {}),
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });
    found.set(collection, docs.docs as unknown as Doc[]);
  }
  const doctorIds = [
    ...new Set(
      (found.get('articles') ?? [])
        .flatMap((doc) => [idOf(doc.authorDoctor), idOf(doc.reviewer)])
        .filter((id): id is string => id !== null),
    ),
  ];
  const publishedDoctors = new Set(
    doctorIds.length === 0
      ? []
      : (
          await payload.find({
            collection: 'doctors',
            where: { and: [{ id: { in: doctorIds } }, { _status: { equals: 'published' } }] },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs.map((doc) => String(doc.id)),
  );
  for (const [collection, docs] of found) {
    const config = payload.collections[collection as CollectionSlug].config;
    const spec = seoSpecOf(config.fields);
    const titleField = config.admin?.useAsTitle ?? 'id';
    for (const doc of docs) {
      for (const rule of seoProblems(collection, doc, spec, publishedDoctors)) {
        report[rule].push({
          collection,
          id: doc.id as number | string,
          title: String(doc[titleField] ?? doc.id),
          href: `/admin/collections/${collection}/${encodeURIComponent(String(doc.id))}`,
        });
      }
    }
  }
  return report;
}
