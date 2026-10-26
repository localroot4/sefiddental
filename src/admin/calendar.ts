import type { CollectionSlug, Payload } from 'payload';

import { adminText } from '@/i18n/fa-admin';
import { type DateKey, zonedDateKey } from '@/lib/jalali';
import { ADMIN_ROUTE } from '@/lib/paths';

/**
 * The editorial calendar (H12, H13): Payload's own `schedulePublish` jobs plus the articles
 * published lately, grouped by Tehran day. A failed publish stays listed until its document is
 * published, so the block message is never lost.
 */
export const CALENDAR_PATH = `${ADMIN_ROUTE}/content-calendar`;
export const DAYS_AHEAD = 60;
export const DAYS_BACK = 30;
const DAY_MS = 86_400_000;

export type CalendarKind = 'scheduled' | 'published' | 'failed';

export interface CalendarItem {
  kind: CalendarKind;
  at: string;
  collection: string;
  id: string;
  title: string;
  href: string;
  unpublish?: boolean;
  message?: string;
}

export interface CalendarDay {
  key: DateKey;
  items: CalendarItem[];
}

/** The fields of a `payload-jobs` row the calendar reads. */
export interface JobRow {
  id: number | string;
  input?: { type?: string | null; doc?: { relationTo: string; value: unknown } | null } | null;
  waitUntil?: string | null;
  completedAt?: string | null;
  hasError?: boolean | null;
  error?: unknown;
  updatedAt?: string | null;
}

export interface DocInfo {
  title: string;
  published: boolean;
}

export type DocKey = `${string}:${string}`;
export const docKey = (collection: string, id: unknown): DocKey => `${collection}:${String(id)}`;

const href = (collection: string, id: unknown) =>
  `${ADMIN_ROUTE}/collections/${collection}/${encodeURIComponent(String(id))}`;

/** The job's block message (src/admin/schedulePublish.ts); an English line becomes a Persian one. */
export function failureMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() && !/[A-Za-z]{3}/.test(message)
    ? message
    : adminText('admin.calendar.failedNoMessage');
}

/** Pending publishes up to 60 days ahead, and failed ones whose document is still unpublished. */
export function scheduleItems(
  jobs: readonly JobRow[],
  docs: ReadonlyMap<DocKey, DocInfo>,
  now: Date,
): CalendarItem[] {
  const horizon = now.getTime() + DAYS_AHEAD * DAY_MS;
  return jobs.flatMap((job): CalendarItem[] => {
    const target = job.input?.doc;
    const doc = target ? docs.get(docKey(target.relationTo, target.value)) : undefined;
    if (!target || !doc || job.completedAt) return [];
    const at = job.waitUntil ?? job.updatedAt;
    if (!at) return [];
    const item = {
      at,
      collection: target.relationTo,
      id: String(target.value),
      title: doc.title,
      href: href(target.relationTo, target.value),
      unpublish: job.input?.type === 'unpublish',
    };
    if (job.hasError) {
      return doc.published ? [] : [{ kind: 'failed', ...item, message: failureMessage(job.error) }];
    }
    return Date.parse(at) <= horizon ? [{ kind: 'scheduled', ...item }] : [];
  });
}

/** Articles published in the last 30 days. */
export function publishedItems(
  articles: ReadonlyArray<{
    id: number | string;
    title?: string | null;
    publishedAt?: string | null;
  }>,
  now: Date,
): CalendarItem[] {
  const from = now.getTime() - DAYS_BACK * DAY_MS;
  return articles.flatMap((article): CalendarItem[] => {
    const at = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
    if (!(at >= from && at <= now.getTime())) return [];
    return [
      {
        kind: 'published',
        at: article.publishedAt as string,
        collection: 'articles',
        id: String(article.id),
        title: article.title || adminText('admin.calendar.untitled'),
        href: href('articles', article.id),
      },
    ];
  });
}

/** Items by Tehran calendar day, oldest day first, by time within a day. */
export function groupByDay(items: readonly CalendarItem[]): CalendarDay[] {
  const days = new Map<DateKey, CalendarItem[]>();
  for (const item of [...items].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const key = zonedDateKey(new Date(item.at));
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return [...days].map(([key, dayItems]) => ({ key, items: dayItems }));
}

export interface DraftRow {
  id: number | string;
  title: string;
  reviewState: string;
}

export interface CalendarData {
  items: CalendarItem[];
  drafts: DraftRow[];
}

const titleOf = (payload: Payload, collection: string, doc: Record<string, unknown>) => {
  const field = payload.collections[collection as CollectionSlug]?.config.admin?.useAsTitle;
  const value = field ? doc[field] : undefined;
  return typeof value === 'string' && value ? value : adminText('admin.calendar.untitled');
};

/**
 * Reads the calendar for a viewer who sees `visible` collections (Payload's visible entities),
 * with access overridden: the caller checks the TOTP-verified staff user first.
 */
export async function loadCalendar(
  payload: Payload,
  visible: readonly string[],
  now = new Date(),
): Promise<CalendarData> {
  // shortcut: the first 500 schedule jobs and 100 drafts; page them if the clinic ever has more.
  const jobs = (
    await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'schedulePublish' } },
      depth: 0,
      limit: 500,
      sort: 'waitUntil',
      overrideAccess: true,
    })
  ).docs as unknown as JobRow[];
  const seen = jobs.filter((job) => job.input?.doc && visible.includes(job.input.doc.relationTo));
  const ids = new Map<string, string[]>();
  for (const job of seen) {
    const { relationTo, value } = job.input!.doc!;
    ids.set(relationTo, [...new Set([...(ids.get(relationTo) ?? []), String(value)])]);
  }
  const docs = new Map<DocKey, DocInfo>();
  for (const [collection, list] of ids) {
    // The latest version: a scheduled document is a draft until the job runs.
    const found = await payload.find({
      collection: collection as CollectionSlug,
      where: { id: { in: list } },
      draft: true,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });
    for (const doc of found.docs as unknown as Array<Record<string, unknown>>) {
      docs.set(docKey(collection, doc.id), {
        title: titleOf(payload, collection, doc),
        published: doc._status === 'published',
      });
    }
  }
  if (!visible.includes('articles')) {
    return { items: scheduleItems(seen, docs, now), drafts: [] };
  }
  const since = new Date(now.getTime() - DAYS_BACK * DAY_MS).toISOString();
  const [published, drafts] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { publishedAt: { greater_than_equal: since }, _status: { equals: 'published' } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'articles',
      where: { _status: { equals: 'draft' } },
      draft: true,
      depth: 0,
      limit: 100,
      sort: '-updatedAt',
      overrideAccess: true,
    }),
  ]);
  return {
    items: [...scheduleItems(seen, docs, now), ...publishedItems(published.docs as never, now)],
    drafts: (drafts.docs as unknown as Array<Record<string, unknown>>).map((doc) => ({
      id: doc.id as number | string,
      title: titleOf(payload, 'articles', doc),
      reviewState: String(doc.reviewState ?? ''),
    })),
  };
}
