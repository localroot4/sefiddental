import type { CollectionSlug, Payload, Where } from 'payload';
import { ValidationError } from 'payload';

import { normalizePath } from '@/lib/paths';

import {
  contains,
  isGroup,
  type LooseApi,
  refusal,
  SEED_CONTEXT,
  SEED_FILES,
  storedLinkTargets,
} from './run';
import { pagesYaml, type PagesYaml, servicesYaml, type ServicesYaml } from './schemas';
import { readYaml } from './sources';
import {
  aliasRedirect,
  categoryData,
  type LinkResolver,
  pageData,
  serviceData,
  tierData,
} from './transforms';

/**
 * copy-sync: carries the seed copy changes made since BASELINE.commit into a database seeded
 * before them, three-way and field by field. A field is written only when the database still
 * holds the baseline value and the seed changed it; a value that matches neither is a human edit
 * and is never written. Dry run unless `apply`. It never creates, deletes, publishes or
 * unpublishes, and reads only the seed files that carry copy (services.yaml, pages.yaml).
 */

/**
 * The seed files as they were at BASELINE.commit, before the phase 9 copy changes. A frozen copy,
 * not `git show`: the CI and server workflows check out one commit only (fetch-depth 1). The files
 * are byte-identical to that commit's blobs, so git stores no new object for them.
 */
export const BASELINE = {
  commit: '456c289',
  services: 'docs/content/seed-baseline/services.yaml',
  pages: 'docs/content/seed-baseline/pages.yaml',
} as const;

/**
 * `new-missing`: the document (field `*`) or the document it belongs to (field `category` or
 * `service`) is not in the database; `seed` creates it.
 * `reviewed`: would be updated, but a dentist reviewed the document (C1), so it is held.
 * `not-saved`: would be updated, but Payload refused the save (a warning names the rule).
 * `updated-in-draft`: written to an editor's pending draft of a published document; the live page
 * keeps the old copy until that draft is published.
 * `not-copy`: the seed changed a field that is not copy (a slug, price, order, relation); never
 * written here.
 */
export const FIELD_STATUSES = [
  'updated',
  'unchanged',
  'edited-by-hand',
  'new-missing',
  'reviewed',
  'not-saved',
  'updated-in-draft',
  'not-copy',
] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export interface CopySyncRow {
  collection: CollectionSlug;
  /** The natural key (a key, `service/tier` or a redirect path), never a copy value. */
  key: string;
  /** A dotted field path; `*` for the whole document. */
  field: string;
  status: FieldStatus;
}

export interface CopySyncReport {
  apply: boolean;
  rows: CopySyncRow[];
  warnings: string[];
}

type Data = Record<string, unknown>;
type Id = number | string;

interface SeedDoc {
  collection: CollectionSlug;
  key: string;
  where: Where;
  data: Data;
  /** The relation field whose document is not in the database: reported, not compared. */
  missing?: 'category' | 'service';
}

/**
 * The copy fields: the only ones copy-sync writes. A slug, price, order, relation, redirect or
 * noindex the seed changed is reported as not-copy (seed and the admin own those).
 */
const COPY_FIELDS = new Set([
  'title',
  'navLabel',
  'h1',
  'summary',
  'intro',
  'lead',
  'name',
  'description',
  'faqs',
  'facts',
  'body',
  'blocks',
  'sections',
  'sources',
  'searchTerms',
  'hero.subtext',
  'seo.title',
  'seo.description',
]);
export const isCopy = (field: string): boolean =>
  COPY_FIELDS.has(field) || (!field.startsWith('seo.') && COPY_FIELDS.has(field.split('.')[0]!));

/** The documents a seed version writes, by `collection key`, built with the stored ids. */
function seedDocs(
  services: ServicesYaml,
  pages: PagesYaml,
  ids: { categories: Map<unknown, Id>; services: Map<unknown, Id> },
  link: LinkResolver,
): Map<string, SeedDoc> {
  const docs = new Map<string, SeedDoc>();
  const add = (
    collection: CollectionSlug,
    key: string,
    where: Where,
    data: Data,
    missing?: SeedDoc['missing'],
  ) => docs.set(`${collection} ${key}`, { collection, key, where, data, missing });
  for (const category of services.categories) {
    add(
      'service-categories',
      category.key,
      { key: { equals: category.key } },
      categoryData(category),
    );
  }
  const position = new Map<string, number>();
  for (const service of services.services) {
    const index = (position.get(service.category) ?? 0) + 1;
    position.set(service.category, index);
    // A category or service not in the database yet: reported new-missing; `seed` creates it.
    const categoryId = ids.categories.get(service.category);
    const related = service.related?.map((key) => ids.services.get(key));
    add(
      'services',
      service.key,
      { key: { equals: service.key } },
      {
        ...serviceData(service, categoryId ?? -1, index * 10, link),
        ...(related?.length && !related.includes(undefined) ? { relatedServices: related } : {}),
      },
      categoryId === undefined ? 'category' : undefined,
    );
    const serviceId = ids.services.get(service.key);
    for (const [index, tier] of (service.tiers ?? []).entries()) {
      add(
        'service-tiers',
        `${service.key}/${tier.key}`,
        { and: [{ service: { equals: serviceId ?? -1 } }, { key: { equals: tier.key } }] },
        tierData(tier, serviceId ?? -1, index),
        serviceId === undefined ? 'service' : undefined,
      );
    }
    const alias = aliasRedirect(service);
    if (alias) {
      const from = normalizePath(alias.from);
      add('redirects', from, { from: { equals: from } }, alias);
    }
  }
  for (const page of pages.pages) {
    add('pages', page.key, { key: { equals: page.key } }, pageData(page, link));
  }
  return docs;
}

/** Dotted paths of the fields a seed document sets: a group recurses, anything else is one. */
const fieldPaths = (data: Data, prefix = ''): string[] =>
  Object.entries(data).flatMap(([key, value]) =>
    isGroup(value) ? fieldPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

const valueAt = (doc: unknown, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>((node, key) => (node as Data | undefined)?.[key], doc);

function setAt(target: Data, dotted: string, value: unknown) {
  const keys = dotted.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Data;
  node[keys[keys.length - 1]!] = value;
}

/** Three-way: the stored value against the baseline and the current seed value. */
export function fieldStatus(stored: unknown, before: unknown, now: unknown): FieldStatus {
  if (contains(stored, now)) return 'unchanged';
  return contains(stored, before) ? 'updated' : 'edited-by-hand';
}

export async function runCopySync(
  payload: Payload,
  options: { root: string; apply: boolean },
): Promise<CopySyncReport> {
  const { root, apply } = options;
  const api = payload as unknown as LooseApi;
  const report: CopySyncReport = { apply, rows: [], warnings: [] };

  // Every file is read and validated before the first read of the database.
  const now = {
    services: readYaml(root, SEED_FILES.services, servicesYaml).data,
    pages: readYaml(root, SEED_FILES.pages, pagesYaml).data,
  };
  const before = {
    services: readYaml(root, BASELINE.services, servicesYaml).data,
    pages: readYaml(root, BASELINE.pages, pagesYaml).data,
  };

  const idsByKey = async (collection: CollectionSlug) =>
    new Map(
      (await api.find({ collection, depth: 0, pagination: false, trash: true })).docs.map((doc) => [
        doc.key,
        doc.id as Id,
      ]),
    );
  const ids = {
    categories: await idsByKey('service-categories'),
    services: await idsByKey('services'),
  };
  const targets = await storedLinkTargets(api);
  const link: LinkResolver = (target) => targets.get(normalizePath(target)) ?? null;
  const beforeDocs = seedDocs(before.services, before.pages, ids, link);

  // Rows are pushed before each write, so an aborted run still records what it had reached.
  let written = 0;
  let finished = false;
  try {
    for (const [id, doc] of seedDocs(now.services, now.pages, ids, link)) {
      if (await compareAndWrite(id, doc)) written += 1;
    }
    finished = true;
  } finally {
    if (apply && (written > 0 || !finished)) {
      const note = `${finished ? '' : 'aborted; '}${copySyncSummary(report)}; documents written ${written}`;
      // On an abort the original error matters more than this row: it is logged, not thrown.
      await api
        .create({
          collection: 'audit-log',
          data: {
            action: 'seed',
            entityType: 'system',
            entitySlug: 'copy-sync',
            actorLabel: 'system:copy-sync',
            note,
          },
          context: SEED_CONTEXT,
        })
        .catch((err: unknown) => {
          if (finished) throw err;
          payload.logger.error({ err }, 'copy-sync: the audit row of the aborted run failed');
        });
    }
  }
  return report;

  /** One document: its rows, then (apply) one write of its updated fields; true when written. */
  async function compareAndWrite(id: string, doc: SeedDoc): Promise<boolean> {
    const { collection, key } = doc;
    if (doc.missing) {
      report.rows.push({ collection, key, field: doc.missing, status: 'new-missing' });
      return false;
    }
    const drafts = Boolean(payload.collections[collection]?.config.versions?.drafts);
    const find = (where: Where, draft: boolean) =>
      api.find({ collection, where, limit: 1, depth: 0, trash: true, pagination: false, draft });
    // The latest version, a draft included, as the seeder reads it.
    const stored = (await find(doc.where, drafts)).docs[0];
    if (!stored) {
      report.rows.push({ collection, key, field: '*', status: 'new-missing' });
      return false;
    }
    if (stored.deletedAt) {
      report.rows.push({ collection, key, field: '*', status: 'edited-by-hand' });
      return false;
    }
    // Never publish or unpublish: a published document stays published, a draft gets a draft.
    const draft = drafts && stored._status !== 'published';
    // A draft over a published version: an editor's pending change, and the live page stays old.
    const pending =
      draft && (await find({ id: { equals: stored.id } }, false)).docs[0]?._status === 'published';
    const reviewed = Boolean(stored.reviewer || stored.reviewedBy);
    const patch: Data = {};
    for (const field of fieldPaths(doc.data)) {
      let status = fieldStatus(
        valueAt(stored, field),
        valueAt(beforeDocs.get(id)?.data, field),
        valueAt(doc.data, field),
      );
      if (status === 'updated' && !isCopy(field)) status = 'not-copy';
      if (status === 'updated' && reviewed) status = 'reviewed';
      if (status === 'updated') setAt(patch, field, valueAt(doc.data, field));
      if (status === 'updated' && pending) status = 'updated-in-draft';
      report.rows.push({ collection, key, field, status });
    }
    if (Object.keys(patch).length === 0) return false;
    if (pending) {
      report.warnings.push(
        `${collection} ${key}: the update goes to an editor's pending draft; the live page keeps the old copy until that draft is published`,
      );
    } else if (draft) {
      report.warnings.push(`${collection} ${key}: the update goes to its unpublished draft`);
    }
    if (!apply) return false;
    try {
      await api.update({
        collection,
        id: stored.id,
        data: { ...patch, ...(drafts ? { _status: draft ? 'draft' : 'published' } : {}) },
        draft,
        context: SEED_CONTEXT,
      });
      return true;
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      report.warnings.push(`${collection} ${key}: not saved (${refusal(err)})`);
      for (const row of report.rows)
        if (
          row.collection === collection &&
          row.key === key &&
          (row.status === 'updated' || row.status === 'updated-in-draft')
        )
          row.status = 'not-saved';
      return false;
    }
  }
}

/** Counts per status and the number of documents; never a value. */
export function copySyncSummary(report: CopySyncReport): string {
  const counts = FIELD_STATUSES.map(
    (status) => `${status} ${report.rows.filter((row) => row.status === status).length}`,
  );
  const documents = new Set(report.rows.map((row) => `${row.collection} ${row.key}`)).size;
  return `${report.apply ? 'applied' : 'dry run'}; baseline ${BASELINE.commit}; documents ${documents}; fields: ${counts.join(', ')}`;
}
