import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterForgotPasswordHook,
  CollectionAfterLoginHook,
  CollectionAfterLogoutHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload';

import { clientIpFrom, hashIp } from '@/lib/http/clientIp';
import { readEnv } from '@/lib/env';
import { logFor } from '@/lib/log/logger';

import { ctx, requestIdOf } from './context';

/**
 * H-AUDIT (spec-data 4.1, 6.5): who changed what and when, field paths only, never values.
 * Rows are written with the Local API and the request, so a rolled-back change leaves none
 * (Postgres; SQLite transactions are off, freeze decision 20).
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'trash'
  | 'restore'
  | 'delete'
  | 'login'
  | 'logout'
  | 'forgot_password'
  | 'seed';

// Never a change: timestamps, row ids, generated sizes, redirect hit counters.
const ALWAYS_IGNORED = new Set(['id', 'updatedAt', 'createdAt', 'sizes', 'hits', 'lastHitAt']);
// Top-level auth bookkeeping and secrets: noise, or never to be named per change.
const TOP_LEVEL_IGNORED = new Set([
  'sessions',
  'loginAttempts',
  'lockUntil',
  'hash',
  'salt',
  'resetPasswordToken',
  'resetPasswordExpiration',
  'resetPasswordRequestedAt',
  'totpSecret',
  'hasTotp',
  '_verified',
  '_verificationToken',
]);

// A populated relation compares by id, so depth differences are no change.
const isDocRef = (value: object): value is { id: unknown } =>
  'id' in value && ('createdAt' in value || 'updatedAt' in value);

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (value !== null && typeof value === 'object') {
    if (prefix !== '' && !Array.isArray(value) && isDocRef(value)) {
      out.set(prefix, JSON.stringify(value.id));
      return;
    }
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);
    if (entries.length === 0) out.set(prefix, Array.isArray(value) ? '[]' : '{}');
    for (const [key, child] of entries) {
      if (ALWAYS_IGNORED.has(key) || (prefix === '' && TOP_LEVEL_IGNORED.has(key))) continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, JSON.stringify(value ?? null));
}

/** Dotted paths whose values differ; array rows by index. Values are never returned. */
export function changedFields(before: unknown, after: unknown): string[] {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flatten(before ?? {}, '', a);
  flatten(after ?? {}, '', b);
  const paths = new Set<string>();
  for (const [path, value] of b) if (a.get(path) !== value) paths.add(path);
  for (const path of a.keys()) if (!b.has(path)) paths.add(path);
  return [...paths].filter(Boolean).sort().slice(0, 100);
}

type Row = Record<string, unknown>;

/** The action of an update, from the states before and after (main-row status when it matters). */
export function updateAction(
  before: Row | undefined,
  after: Row,
  mainRowStatus?: string | null,
): AuditAction {
  if (after.deletedAt && !before?.deletedAt) return 'trash';
  if (!after.deletedAt && before?.deletedAt) return 'restore';
  if (after._status === 'published' && before?._status !== 'published') return 'publish';
  if (after._status === 'draft' && before?._status === 'published' && mainRowStatus === 'draft') {
    return 'unpublish';
  }
  return 'update';
}

interface Actor {
  actor: number | string | null;
  actorLabel: string;
  actorRole: string | null;
}

function actorOf(req: PayloadRequest, action: AuditAction): Actor {
  const flags = ctx(req);
  const user = req.user as
    | {
        id: number | string;
        name?: string;
        email?: string;
        role?: string;
        _strategy?: string;
        collection?: string;
      }
    | null
    | undefined;
  if (!user || user.collection !== 'users') {
    return {
      actor: null,
      actorLabel: flags.jobTask ? `system:job:${flags.jobTask}` : 'system',
      actorRole: null,
    };
  }
  // Payload's schedulePublish job passes the scheduling user without an auth strategy.
  const scheduled =
    flags.jobTask === 'schedulePublish' ||
    (user._strategy === undefined && (action === 'publish' || action === 'unpublish'));
  return {
    actor: user.id,
    actorLabel: scheduled
      ? 'system:job:schedulePublish'
      : (user.name ?? user.email ?? String(user.id)),
    actorRole: user.role ?? null,
  };
}

function ipHashOf(req: PayloadRequest): string | null {
  try {
    const env = readEnv();
    const ip = req.headers ? clientIpFrom(req.headers, env) : null;
    return ip ? hashIp(ip, env.ipHashSecret) : null;
  } catch {
    return null;
  }
}

export interface AuditEntry {
  action: AuditAction;
  entityType: 'collection' | 'global' | 'auth' | 'system';
  entitySlug: string;
  docId?: string | null;
  docLabel?: string | null;
  changedFields?: string[];
  statusFrom?: string | null;
  statusTo?: string | null;
  note?: string | null;
  actor?: Actor;
}

const AUTOSAVE_MERGE_MS = 10 * 60 * 1000;

/** Writes one audit row; failures are logged, never thrown (the change itself already happened). */
export async function writeAudit(req: PayloadRequest, entry: AuditEntry): Promise<void> {
  if (ctx(req).skipAudit) return;
  const actor = entry.actor ?? actorOf(req, entry.action);
  try {
    // Autosave flood control: merge into the same actor's recent update row of this document.
    if (entry.action === 'update' && entry.docId && actor.actor !== null) {
      const recent = await req.payload.find({
        collection: 'audit-log',
        where: {
          and: [
            { entitySlug: { equals: entry.entitySlug } },
            { docId: { equals: entry.docId } },
            { actor: { equals: actor.actor } },
            { action: { equals: 'update' } },
            { createdAt: { greater_than: new Date(Date.now() - AUTOSAVE_MERGE_MS).toISOString() } },
          ],
        },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        req,
      });
      const row = recent.docs[0];
      if (row) {
        const merged = [...new Set([...(row.changedFields ?? []), ...(entry.changedFields ?? [])])];
        await req.payload.update({
          collection: 'audit-log',
          id: row.id,
          data: { changedFields: merged.sort().slice(0, 100) },
          depth: 0,
          req,
        });
        return;
      }
    }
    await req.payload.create({
      collection: 'audit-log',
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entitySlug: entry.entitySlug,
        docId: entry.docId ?? null,
        docLabel: entry.docLabel?.slice(0, 120) ?? null,
        changedFields: entry.changedFields ?? [],
        statusFrom: entry.statusFrom ?? null,
        statusTo: entry.statusTo ?? null,
        actor: actor.actor as number,
        actorLabel: actor.actorLabel,
        actorRole: actor.actorRole,
        requestId: requestIdOf(req) ?? null,
        ipHash: ipHashOf(req),
        note: entry.note ?? null,
      },
      depth: 0,
      req,
    });
  } catch (err) {
    logFor(requestIdOf(req), 'hook:audit').error(
      {
        entitySlug: entry.entitySlug,
        docId: entry.docId,
        err: err instanceof Error ? err.message : String(err),
      },
      'audit row not written',
    );
  }
}

interface CollectionAuditOptions {
  /** The list title snapshot; bookings pass '#id' (never a phone or name). */
  label?: (doc: Row) => string | null;
  /** 'status' for bookings; '_status' otherwise. */
  statusField?: string;
  /** Only these top-level fields count as a change (users: name, email, role). */
  only?: readonly string[];
}

export function auditCollection(options: CollectionAuditOptions = {}) {
  const statusField = options.statusField ?? '_status';
  const labelOf = (doc: Row, useAsTitle: string) =>
    options.label
      ? options.label(doc)
      : typeof doc[useAsTitle] === 'string'
        ? (doc[useAsTitle] as string)
        : null;

  const afterChange: CollectionAfterChangeHook = async ({
    collection,
    doc,
    previousDoc,
    operation,
    req,
  }) => {
    if (ctx(req).seeding) return doc;
    const before = operation === 'create' ? undefined : (previousDoc as Row);
    let fields = changedFields(before, doc);
    if (options.only) fields = fields.filter((f) => options.only?.includes(f.split('.')[0] ?? ''));
    let action: AuditAction;
    if (operation === 'create') {
      action = doc._status === 'published' ? 'publish' : 'create';
    } else {
      let mainStatus: string | null = null;
      if (doc._status === 'draft' && before?._status === 'published') {
        const main = await req.payload.findByID({
          collection: collection.slug,
          id: doc.id,
          draft: false,
          depth: 0,
          trash: true,
          disableErrors: true,
          req,
        });
        mainStatus = ((main as Row | null)?._status as string | undefined) ?? null;
      }
      action = updateAction(before, doc, mainStatus);
      if (action === 'update' && fields.length === 0) return doc;
    }
    const from = before?.[statusField];
    const to = (doc as Row)[statusField];
    await writeAudit(req, {
      action,
      entityType: 'collection',
      entitySlug: collection.slug,
      docId: String(doc.id),
      docLabel: labelOf(doc, collection.admin?.useAsTitle ?? 'id'),
      changedFields: fields,
      statusFrom: from !== to && typeof from === 'string' ? from : null,
      statusTo: from !== to && typeof to === 'string' ? to : null,
    });
    return doc;
  };

  const afterDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
    if (ctx(req).seeding) return doc;
    await writeAudit(req, {
      action: 'delete',
      entityType: 'collection',
      entitySlug: collection.slug,
      docId: String(doc.id),
      docLabel: labelOf(doc, collection.admin?.useAsTitle ?? 'id'),
    });
    return doc;
  };

  return { afterChange, afterDelete };
}

export function auditGlobal(slug: string): GlobalAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    if (ctx(req).seeding) return doc;
    const fields = changedFields(previousDoc, doc).filter((f) => f !== 'globalType');
    if (fields.length > 0) {
      await writeAudit(req, {
        action: 'update',
        entityType: 'global',
        entitySlug: slug,
        changedFields: fields,
      });
    }
    return doc;
  };
}

const authUser = (user: Row): Actor => ({
  actor: user.id as number | string,
  actorLabel:
    (user.name as string | undefined) ?? (user.email as string | undefined) ?? String(user.id),
  actorRole: (user.role as string | undefined) ?? null,
});

export const auditLogin: CollectionAfterLoginHook = async ({ req, user }) => {
  await writeAudit(req, {
    action: 'login',
    entityType: 'auth',
    entitySlug: 'users',
    docId: String(user.id),
    actor: authUser(user as Row),
  });
  return user;
};

export const auditLogout: CollectionAfterLogoutHook = async ({ req }) => {
  if (req.user) {
    await writeAudit(req, {
      action: 'logout',
      entityType: 'auth',
      entitySlug: 'users',
      docId: String(req.user.id),
      actor: authUser(req.user as unknown as Row),
    });
  }
};

/** Payload runs this hook only when the email belongs to an account; the email is not stored. */
export const auditForgotPassword: CollectionAfterForgotPasswordHook = async ({ args }) => {
  const req = (args as { req?: PayloadRequest } | undefined)?.req;
  if (!req) return;
  await writeAudit(req, {
    action: 'forgot_password',
    entityType: 'auth',
    entitySlug: 'users',
    actor: { actor: null, actorLabel: 'public:forgot-password', actorRole: null },
  });
};
