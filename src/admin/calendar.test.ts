import { describe, expect, it } from 'vitest';

import { adminText } from '@/i18n/fa-admin';
import { ADMIN_ROUTE } from '@/lib/paths';

import {
  docKey,
  failureMessage,
  groupByDay,
  type JobRow,
  loadCalendar,
  publishedItems,
  scheduleItems,
} from './calendar';

// 18 Oct 2026, 12:00 in Tehran (UTC+3:30).
const NOW = new Date('2026-10-18T08:30:00Z');
const inDays = (days: number, hourUtc = 8) =>
  new Date(Date.UTC(2026, 9, 18 + days, hourUtc, 30)).toISOString();

const job = (id: number, extra: Partial<JobRow> = {}): JobRow => ({
  id,
  input: { type: 'publish', doc: { relationTo: 'articles', value: String(id) } },
  waitUntil: inDays(3),
  ...extra,
});

const docs = new Map([
  [docKey('articles', 1), { title: 'مقالهٔ یک', published: false }],
  [docKey('articles', 2), { title: 'مقالهٔ دو', published: false }],
  [docKey('articles', 3), { title: 'مقالهٔ سه', published: true }],
]);

describe('editorial calendar (H12, H13)', () => {
  it('CAL1 a pending publish lands on its day with the title and the document link', () => {
    expect(scheduleItems([job(1)], docs, NOW)).toEqual([
      {
        kind: 'scheduled',
        at: inDays(3),
        collection: 'articles',
        id: '1',
        title: 'مقالهٔ یک',
        href: `${ADMIN_ROUTE}/collections/articles/1`,
        unpublish: false,
      },
    ]);
  });

  it('CAL2 past the 60-day horizon, completed, or without a document: left out', () => {
    const items = scheduleItems(
      [
        job(1, { waitUntil: inDays(61) }),
        job(2, { completedAt: inDays(-1) }),
        job(9),
        job(10, { input: { type: 'publish' } }),
      ],
      docs,
      NOW,
    );
    expect(items).toEqual([]);
    // A publish whose time passed but the cron has not run yet still waits.
    expect(scheduleItems([job(1, { waitUntil: inDays(-1) })], docs, NOW)).toHaveLength(1);
  });

  it('CAL3 a failed publish shows the block message, never Payload’s English line', () => {
    const [failed] = scheduleItems(
      [job(1, { hasError: true, error: { message: 'دست‌کم یک منبع علمی اضافه کنید.' } })],
      docs,
      NOW,
    );
    expect(failed).toMatchObject({ kind: 'failed', message: 'دست‌کم یک منبع علمی اضافه کنید.' });
    expect(failureMessage({ message: 'The following field is invalid: sources' })).toBe(
      adminText('admin.calendar.failedNoMessage'),
    );
    expect(failureMessage(null)).toBe(adminText('admin.calendar.failedNoMessage'));
  });

  it('CAL4 a failed publish is resolved once its document is published', () => {
    expect(scheduleItems([job(3, { hasError: true })], docs, NOW)).toEqual([]);
  });

  it('CAL5 articles published in the last 30 days; older and future ones are left out', () => {
    const items = publishedItems(
      [
        { id: 5, title: 'تازه', publishedAt: inDays(-2) },
        { id: 6, title: 'کهنه', publishedAt: inDays(-31) },
        { id: 7, title: 'آینده', publishedAt: inDays(1) },
        { id: 8, title: 'بی‌تاریخ', publishedAt: null },
      ],
      NOW,
    );
    expect(items.map((i) => [i.kind, i.title, i.href])).toEqual([
      ['published', 'تازه', `${ADMIN_ROUTE}/collections/articles/5`],
    ]);
  });

  it('CAL6 days follow the Tehran calendar, oldest first, items by time', () => {
    // 21:00 UTC is 00:30 the next day in Tehran.
    const late = job(1, { waitUntil: inDays(2, 21) });
    const early = job(2, { waitUntil: inDays(3, 5) });
    const days = groupByDay([
      ...scheduleItems([early, late], docs, NOW),
      ...publishedItems([{ id: 5, title: 'تازه', publishedAt: inDays(-1) }], NOW),
    ]);
    expect(days.map((d) => [d.key, d.items.map((i) => i.title)])).toEqual([
      ['2026-10-17', ['تازه']],
      ['2026-10-21', ['مقالهٔ یک', 'مقالهٔ دو']],
    ]);
  });

  it('CAL7 a scheduled unpublish is marked', () => {
    const [item] = scheduleItems(
      [job(1, { input: { type: 'unpublish', doc: { relationTo: 'articles', value: '1' } } })],
      docs,
      NOW,
    );
    expect(item?.unpublish).toBe(true);
  });

  it('CAL8 the loader reads only the collections the viewer sees, drafts as their latest version', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const rows: Record<string, unknown[]> = {
      'payload-jobs': [
        job(1),
        job(4, { input: { type: 'publish', doc: { relationTo: 'pages', value: '4' } } }),
      ],
      articles: [{ id: 1, title: 'مقالهٔ یک', _status: 'draft', reviewState: 'in_review' }],
    };
    const payload = {
      collections: {
        articles: { config: { admin: { useAsTitle: 'title' } } },
        pages: { config: { admin: { useAsTitle: 'title' } } },
      },
      find: async (args: Record<string, unknown>) => {
        calls.push(args);
        return { docs: rows[args.collection as string] ?? [] };
      },
    };
    const data = await loadCalendar(payload as never, ['articles', 'cases'], NOW);
    expect(data.items.map((i) => i.id)).toEqual(['1']);
    expect(calls.find((c) => c.collection === 'pages')).toBeUndefined();
    const jobsCall = calls.find((c) => c.collection === 'payload-jobs');
    expect(jobsCall).toMatchObject({
      where: { taskSlug: { equals: 'schedulePublish' } },
      overrideAccess: true,
    });
    const titles = calls.find((c) => c.collection === 'articles' && c.draft === true);
    expect(titles?.where).toEqual({ id: { in: ['1'] } });
    expect(data.drafts).toEqual([{ id: 1, title: 'مقالهٔ یک', reviewState: 'in_review' }]);
  });
});
