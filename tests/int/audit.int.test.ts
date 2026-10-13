import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getTestPayload, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;

const auditRows = async (entitySlug: string, docId: string | number) =>
  (
    await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ entitySlug: { equals: entitySlug } }, { docId: { equals: String(docId) } }],
      },
      sort: 'createdAt',
      depth: 0,
      pagination: false,
    })
  ).docs;

describe('audit log (spec-data 4.1, 6.5)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
  });

  it('AD1 one row per change with field paths; quick updates by one person merge', async () => {
    const tag = await payload.create({
      collection: 'tags',
      data: { title: `برچسب ${unique()}` } as never,
      user: admin,
    });
    await payload.update({
      collection: 'tags',
      id: tag.id,
      data: { title: `برچسب دیگر ${unique()}` },
      user: admin,
    });
    await payload.update({
      collection: 'tags',
      id: tag.id,
      data: { description: 'توضیح کوتاه' },
      user: admin,
    });
    const rows = await auditRows('tags', tag.id);
    expect(rows.map((r) => r.action)).toEqual(['create', 'update']);
    expect(rows[1]).toMatchObject({ actor: admin.id, actorLabel: admin.name, actorRole: 'admin' });
    // The slug stays: a title change never rewrites a stored slug.
    expect(rows[1]?.changedFields).toEqual(['description', 'title']);
  });

  it('AD2 publish, unpublish and trash are named; a draft save is an update', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: { title: `مقاله ${unique()}` },
      draft: true,
      user: editor,
    });
    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { title: 'ب' },
      draft: true,
      user: editor,
    });
    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { deletedAt: new Date().toISOString() },
      draft: true,
      user: editor,
    });
    const actions = (await auditRows('articles', article.id)).map((r) => r.action);
    expect(actions[0]).toBe('create');
    expect(actions).toContain('trash');
    expect(actions).not.toContain('unpublish');
  });

  it('AD3 bookings: the row says #id; no phone, name or note value anywhere in the audit log', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        phone: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
        name: 'نام‌محرمانه',
        note: 'یادداشت‌محرمانه',
        kind: 'regular',
      } as never,
      user: editor,
    });
    expect(booking).toMatchObject({ phone: '+989123456789', phoneNational: '09123456789' });
    expect(booking.listTitle).toBe('نام‌محرمانه · ۰۹۱۲ ••• ۶۷۸۹');
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'contacted' },
      user: editor,
    });
    const rows = await auditRows('bookings', booking.id);
    expect(rows.map((r) => r.docLabel)).toEqual([`#${booking.id}`, `#${booking.id}`]);
    expect(rows[1]).toMatchObject({ statusFrom: 'new', statusTo: 'contacted' });
    const everything = JSON.stringify(
      (await payload.find({ collection: 'audit-log', depth: 0, pagination: false })).docs,
    );
    for (const secret of ['9123456789', '۰۹۱۲', 'نام‌محرمانه', 'یادداشت‌محرمانه']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('AD4 editors follow the status table; admins may set any status', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: { phone: '09121112233' } as never,
      user: editor,
    });
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'done' },
      user: admin,
    });
    await expect(
      payload.update({
        collection: 'bookings',
        id: booking.id,
        data: { status: 'new' },
        user: editor,
      }),
    ).rejects.toMatchObject({
      data: { errors: [{ message: 'تغییر وضعیت از «انجام شد» به «جدید» مجاز نیست.' }] },
    });
  });
});
