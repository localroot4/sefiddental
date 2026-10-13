import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
} from 'payload';
import { ValidationError } from 'payload';

import { buildPath, hubPath, normalizePath, type PathCollection, type PathDoc } from '@/lib/paths';

import { ctx } from './context';

type Doc = Record<string, unknown> & { id: number | string };

/**
 * H-PATH to H-REDIR hand-over, per request and keyed `<slug>:<id>` (a bulk update runs its
 * documents in parallel on one request). Not on `req.context`: every nested Local API call that
 * passes `req` replaces that object (payload createLocalReq), so a value written there between
 * the two hooks can be lost.
 */
const prevPaths = new WeakMap<PayloadRequest, Map<string, string | null>>();
function prevPathsOf(req: PayloadRequest): Map<string, string | null> {
  let map = prevPaths.get(req);
  if (!map) prevPaths.set(req, (map = new Map()));
  return map;
}

const pathDocOf = (doc: Doc): PathDoc => ({
  slug: typeof doc.slug === 'string' ? doc.slug : null,
  key: typeof doc.key === 'string' ? doc.key : null,
  // A standalone category resolves to its service's path, which the service owns.
  standalone: Boolean(doc.standalone),
});

const hasDrafts = (req: PayloadRequest, collection: PathCollection): boolean =>
  Boolean(req.payload.collections[collection]?.config.versions?.drafts);

/** The main row (never a draft version): the published state lives there (spec-data 6.4). */
async function mainRow(req: PayloadRequest, collection: PathCollection, id: Doc['id']) {
  return (await req.payload.findByID({
    collection,
    id,
    draft: false,
    depth: 0,
    trash: true,
    disableErrors: true,
    req,
  })) as Doc | null;
}

function livePath(req: PayloadRequest, collection: PathCollection, row: Doc | null): string | null {
  if (!row || row.deletedAt) return null;
  if (hasDrafts(req, collection) && row._status !== 'published') return null;
  return buildPath(collection, pathDocOf(row));
}

/** A redirect never shadows a live page. */
async function deactivateFrom(req: PayloadRequest, path: string): Promise<void> {
  await req.payload.update({
    collection: 'redirects',
    where: { and: [{ from: { equals: path } }, { active: { equals: true } }] },
    data: { active: false },
    depth: 0,
    req,
  });
}

async function upsertRedirect(
  req: PayloadRequest,
  from: string,
  to: string,
  source: 'slug_change' | 'auto_removed',
): Promise<void> {
  const found = await req.payload.find({
    collection: 'redirects',
    where: { from: { equals: normalizePath(from) } },
    limit: 1,
    depth: 0,
    req,
  });
  const data = { from, to, statusCode: '301' as const, source, active: true };
  const existing = found.docs[0];
  if (existing) {
    await req.payload.update({ collection: 'redirects', id: existing.id, data, depth: 0, req });
  } else {
    await req.payload.create({ collection: 'redirects', data, depth: 0, req });
  }
}

/**
 * H-PATH and H-REDIR for collections with a public path: a slug change on a published document
 * adds a 301 from the old path; unpublish, trash and delete send the old path to the hub;
 * publishing a path deactivates any redirect from it. Decided from the main row before and after
 * the write, never from `doc._status`: a draft save leaves the main row as it was.
 */
export function publicPathHooks(collection: PathCollection) {
  const keyOf = (id: Doc['id']) => `${collection}:${id}`;

  const beforeChange: CollectionBeforeChangeHook = async ({ operation, originalDoc, req }) => {
    if (operation !== 'update' || ctx(req).skipRedirects || !originalDoc) return;
    const before = await mainRow(req, collection, (originalDoc as Doc).id);
    prevPathsOf(req).set(keyOf((originalDoc as Doc).id), livePath(req, collection, before));
  };

  const afterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
    if (ctx(req).skipRedirects) return doc;
    const id = (doc as Doc).id;
    const prev = prevPathsOf(req).get(keyOf(id)) ?? null;
    prevPathsOf(req).delete(keyOf(id));
    const now = livePath(req, collection, await mainRow(req, collection, id));
    if (now) {
      await deactivateFrom(req, now);
      if (prev && prev !== now) await upsertRedirect(req, prev, now, 'slug_change');
    } else if (prev) {
      await upsertRedirect(req, prev, hubPath(collection, pathDocOf(doc as Doc)), 'auto_removed');
    }
    return doc;
  };

  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
    if (ctx(req).skipRedirects) return doc;
    // A trashed document got its redirect when it was trashed.
    const gone = livePath(req, collection, doc as Doc);
    if (gone)
      await upsertRedirect(req, gone, hubPath(collection, pathDocOf(doc as Doc)), 'auto_removed');
    return doc;
  };

  return { beforeChange, afterChange, afterDelete };
}

// ---------------------------------------------------------------------------------------------
// H-REDIRVALID: the redirects collection itself (spec-data 2.13).

const LOOP_MESSAGE = 'این انتقال به خودش برمی‌گردد. مقصد دیگری انتخاب کنید.';

/** Splits '/path#fragment' and normalizes the path part; the fragment is kept as typed. */
export function normalizeTarget(to: string): string {
  const hash = to.indexOf('#');
  const path = normalizePath(hash === -1 ? to : to.slice(0, hash));
  return hash === -1 ? path : `${path}${to.slice(hash)}`;
}

const targetPath = (to: string): string => normalizePath(to);

export const normalizeRedirect: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  const out = { ...data };
  if (typeof out.from === 'string') out.from = normalizePath(out.from.trim());
  if (out.statusCode === '410') out.to = null;
  else if (typeof out.to === 'string' && out.to.trim().startsWith('/')) {
    out.to = normalizeTarget(out.to.trim());
  }
  return out;
};

/** No chains (point at the final target) and no loops. */
export const flattenRedirect: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  collection,
  req,
}) => {
  const from = (data.from ?? originalDoc?.from) as string | undefined;
  let to = (data.to ?? originalDoc?.to) as string | null | undefined;
  const active = (data.active ?? originalDoc?.active ?? true) as boolean;
  if (!from || !to || !active) return data;
  const seen = new Set<string>([from]);
  for (let hop = 0; hop < 10; hop += 1) {
    const path = targetPath(to);
    if (seen.has(path)) {
      throw new ValidationError({
        collection: collection.slug,
        errors: [{ path: 'to', message: LOOP_MESSAGE }],
      });
    }
    const next = await req.payload.find({
      collection: 'redirects',
      where: { and: [{ from: { equals: path } }, { active: { equals: true } }] },
      limit: 1,
      depth: 0,
      req,
    });
    const row = next.docs[0];
    if (!row || !row.to || row.id === originalDoc?.id) break;
    seen.add(path);
    to = row.to;
  }
  return { ...data, to };
};

/** After a save, rows that pointed at this row's `from` point at its final target instead. */
export const repointChains: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!doc.active || !doc.to || doc.statusCode === '410') return doc;
  const pointing = await req.payload.find({
    collection: 'redirects',
    where: {
      and: [
        { to: { equals: doc.from } },
        { active: { equals: true } },
        { id: { not_equals: doc.id } },
      ],
    },
    depth: 0,
    pagination: false,
    req,
  });
  for (const row of pointing.docs) {
    // A row that would now point at itself is switched off instead.
    const data = targetPath(doc.to) === row.from ? { active: false } : { to: doc.to };
    await req.payload.update({ collection: 'redirects', id: row.id, data, depth: 0, req });
  }
  return doc;
};
