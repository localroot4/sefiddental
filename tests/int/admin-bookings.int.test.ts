// Admin booking workflow on the database (freeze G15, admin-notify.md 4, 7, 9.7, 9.8): bulk spam
// and restore through the record hooks, the close note, field access for editors, the CSV
// endpoint, today's counts and the notifier test action.
import { randomInt } from 'node:crypto';

import { createLocalReq, type Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { bookingCounts, COUNT_NAMES } from '@/admin/bookings/counts';
import { exportBookingsCsv } from '@/admin/bookings/exportEndpoint';
import { createNotifierTest } from '@/globals/notifierAdmin';
import { readEnv } from '@/lib/env';
import { createRateLimiter } from '@/lib/http/rateLimit';

import { getTestPayload, type StaffUser, staffUsers } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;

const mobile = () => `0935${String(randomInt(10_000_000)).padStart(7, '0')}`;
// An enrolled admin whose session has not entered a code yet.
const unverified = () => ({ ...admin, _strategy: 'local-jwt', hasTotp: true });

async function booking(data: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'bookings',
    data: { phone: mobile(), kind: 'regular', ...data } as never,
    overrideAccess: true,
  });
}

const notesOf = async (id: number | string) =>
  (await payload.findByID({ collection: 'bookings', id, depth: 0 })).adminNotes ?? [];

const auditOf = async (id: number | string) =>
  (
    await payload.find({
      collection: 'audit-log',
      where: { and: [{ entitySlug: { equals: 'bookings' } }, { docId: { equals: String(id) } }] },
      depth: 0,
      pagination: false,
    })
  ).docs;

describe('admin booking workflow (freeze G15)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
  });

  it('AC7 editor bulk spam: allowed moves change, a scheduled request is refused and counted', async () => {
    const rows = await Promise.all([booking(), booking({ status: 'contacted' }), booking()]);
    await payload.update({
      collection: 'bookings',
      id: rows[2]!.id,
      data: { status: 'scheduled' },
      user: admin,
    });
    const result = await payload.update({
      collection: 'bookings',
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'spam' },
      user: editor,
      overrideAccess: false,
    });
    expect(result.docs.map((d) => d.status)).toEqual(['spam', 'spam']);
    // The bulk answer counts refusals; the reason stays on the record (the toast says why).
    expect(result.errors.map((e) => e.id)).toEqual([rows[2]!.id]);
    expect((await notesOf(rows[0]!.id)).at(-1)).toMatchObject({
      text: 'وضعیت از «جدید» به «هرزنامه» تغییر کرد.',
      author: editor.id,
    });
  });

  it('AC8 one-click restore: suspicious to new adds «restored», a history note and an audit row', async () => {
    const row = await booking({ status: 'suspicious', flags: ['honeypot'] });
    const restored = await payload.update({
      collection: 'bookings',
      id: row.id,
      data: { status: 'new' },
      user: editor,
      overrideAccess: false,
    });
    expect(restored.flags).toEqual(['honeypot', 'restored']);
    expect(restored.adminNotes?.at(-1)?.text).toBe('وضعیت از «مشکوک» به «جدید» تغییر کرد.');
    expect(await auditOf(row.id)).toContainEqual(
      expect.objectContaining({ statusFrom: 'suspicious', statusTo: 'new', actor: editor.id }),
    );
  });

  it('BK11 closing needs the handler’s own note; the save keeps it and the history line', async () => {
    const row = await booking({ status: 'contacted' });
    await expect(
      payload.update({
        collection: 'bookings',
        id: row.id,
        data: { status: 'done' },
        user: editor,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          {
            path: 'status',
            message: 'برای «انجام شد» اول در «یادداشت‌های پذیرش» یک یادداشت تازه بنویسید که چه شد.',
          },
        ],
      },
    });
    const done = await payload.update({
      collection: 'bookings',
      id: row.id,
      data: { status: 'done', adminNotes: [{ text: 'بیمار آمد؛ جرم‌گیری انجام شد.' }] },
      user: editor,
      depth: 0,
    });
    expect(done.adminNotes?.map((n) => [n.text, n.author])).toEqual([
      ['بیمار آمد؛ جرم‌گیری انجام شد.', editor.id],
      ['وضعیت از «تماس گرفته شد» به «انجام شد» تغییر کرد.', editor.id],
    ]);
  });

  it('BK6 removing emergency priority on one request re-ranks the phone’s open emergencies', async () => {
    const phone = mobile();
    const emergency = () => booking({ phone, kind: 'emergency', triage: ['swelling'] });
    const rows = [await emergency(), await emergency()];
    const ranks = () =>
      Promise.all(
        rows.map(
          async (r) =>
            (await payload.findByID({ collection: 'bookings', id: r.id, depth: 0 })).urgencyRank,
        ),
      );
    expect(await ranks()).toEqual([0, 0]);
    const flag = (flags: string[]) =>
      payload.update({
        collection: 'bookings',
        id: rows[0]!.id,
        data: { flags } as never,
        user: editor,
        overrideAccess: false,
      });
    const updates = (id: number) =>
      auditOf(id).then((docs) => docs.filter((d) => d.action === 'update'));
    await flag(['emergency_priority_removed']);
    expect(await ranks()).toEqual([1, 1]);
    // The editor's save keeps its audit row; the re-rank writes none.
    expect(await updates(rows[0]!.id)).toHaveLength(1);
    await flag([]);
    expect(await ranks()).toEqual([0, 0]);
    expect(await updates(rows[1]!.id)).toHaveLength(0);
  });

  it('AC9 editors never get the IP hash, on the row or on an appended request', async () => {
    const hash = 'a'.repeat(64);
    const row = await booking({
      ipHash: hash,
      duplicateSubmissions: [{ at: new Date().toISOString(), ipHash: hash }],
    });
    const asEditor = await payload.findByID({
      collection: 'bookings',
      id: row.id,
      user: editor,
      overrideAccess: false,
    });
    expect(JSON.stringify(asEditor)).not.toContain(hash);
    expect(asEditor.duplicateSubmissions).toHaveLength(1);
    const asAdmin = await payload.findByID({
      collection: 'bookings',
      id: row.id,
      user: admin,
      overrideAccess: false,
    });
    expect(asAdmin.ipHash).toBe(hash);
    expect(asAdmin.duplicateSubmissions?.[0]?.ipHash).toBe(hash);
  });
});

describe('CSV export endpoint (admin-notify.md 4.8, D-8)', () => {
  const run = async (user: object, query: Record<string, unknown> = {}) =>
    exportBookingsCsv(await createLocalReq({ user: user as never, req: { query } }, payload));

  it('CSV3 a TOTP-verified admin gets the filtered rows as a no-store attachment', async () => {
    const phone = mobile();
    await booking({ phone, name: 'بیمار خروجی', heardFrom: 'google' });
    const response = await run(admin, { search: phone });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="bookings-\d{4}-\d{2}-\d{2}-\d{4}\.csv"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    const lines = new TextDecoder().decode(bytes).split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.startsWith('"شمارهٔ درخواست"')).toBe(true);
    expect(lines[1]).toContain(`"${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}"`);
    expect(lines[1]).toContain('"جست‌وجوی گوگل"');
  });

  it('AC10 editors and unverified sessions get 403; a bad filter is 400', async () => {
    for (const user of [editor, unverified()]) {
      const response = await run(user);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message: 'فقط مدیر می‌تواند خروجی بگیرد.' });
    }
    const bad = await run(admin, { where: { noSuchField: { equals: 'x' } } });
    expect(bad.status).toBe(400);
    // The adapter drops a value that is not a date and the query fails: refused before it.
    const date = await run(admin, {
      where: { or: [{ and: [{ createdAt: { greater_than_equal: 'garbage' } }] }] },
    });
    expect(date.status).toBe(400);
    expect(await date.json()).toEqual({
      message: 'فیلتر این فهرست خوانده نشد. فیلتر را پاک کنید و دوباره بزنید.',
    });
  });

  it('CSV4 no audit row, no file: the export answers 500 with the reason', async () => {
    const create = payload.create.bind(payload);
    const spy = vi
      .spyOn(payload, 'create')
      .mockImplementation(((args: { collection: string }) =>
        args.collection === 'audit-log'
          ? Promise.reject(new Error('audit table unavailable'))
          : create(args as never)) as never);
    try {
      const response = await run(admin);
      expect(response.status).toBe(500);
      expect(response.headers.get('content-disposition')).toBeNull();
      expect(await response.json()).toEqual({
        message: 'فایل ساخته نشد، چون ثبت آن در سابقهٔ تغییرات انجام نشد. دوباره بزنید.',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('AD6 an export writes one audit row with the count and field paths, never a value', async () => {
    const phone = mobile();
    await booking({ phone });
    await run(admin, { search: phone, where: { status: { equals: 'new' } } });
    const rows = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'export' } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    });
    expect(rows.docs[0]).toMatchObject({
      entitySlug: 'bookings',
      actor: admin.id,
      note: 'خروجی CSV با ۱ ردیف؛ فیلتر روی: name، phoneNational، status',
    });
    expect(JSON.stringify(rows.docs[0])).not.toContain(phone);
  });
});

describe('today’s numbers (admin-notify.md 4.9)', () => {
  it('DW4 counts move by one per matching request; suspicious and spam are not «تازه»', async () => {
    const before = await bookingCounts(payload, COUNT_NAMES);
    await booking({
      kind: 'emergency',
      triage: ['swelling'],
      emergencyOutcome: 'not_urgent',
      callbackDueAt: new Date(Date.now() - 60_000).toISOString(),
    });
    // Not called back yet: no outcome, so not in this month's share.
    await booking({ kind: 'emergency', triage: ['broken'] });
    await booking({ status: 'suspicious' });
    await booking({ status: 'spam' });
    const after = await bookingCounts(payload, COUNT_NAMES);
    expect({
      newToday: after.newToday! - before.newToday!,
      emergencyToday: after.emergencyToday! - before.emergencyToday!,
      waiting: after.waiting! - before.waiting!,
      overdue: after.overdue! - before.overdue!,
      openEmergency: after.openEmergency! - before.openEmergency!,
      suspiciousToday: after.suspiciousToday! - before.suspiciousToday!,
      notUrgentMonth: after.notUrgentMonth! - before.notUrgentMonth!,
      outcomeMonth: after.outcomeMonth! - before.outcomeMonth!,
    }).toEqual({
      newToday: 2,
      emergencyToday: 2,
      waiting: 2,
      overdue: 1,
      openEmergency: 2,
      suspiciousToday: 1,
      notUrgentMonth: 1,
      outcomeMonth: 1,
    });
  });
});

describe('notifier settings (admin-notify.md 9.7, 9.8)', () => {
  it('NT13 an admin cannot turn mail on while the server has no SMTP', async () => {
    expect(readEnv().smtp).toBeNull();
    await expect(
      payload.updateGlobal({
        slug: 'notifier',
        data: { mail: { enabled: true, recipients: [{ email: 'reception@sefid.test' }] } },
        user: admin,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message:
              'برای ایمیل، تنظیمات SMTP روی سرور لازم است. از پشتیبانی فنی بخواهید آن را تنظیم کند.',
          }),
        ],
      },
    });
  });

  const testAction = () =>
    createNotifierTest({
      env: readEnv,
      limiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
      now: Date.now,
    });
  const callAs = async (endpoint: ReturnType<typeof testAction>, user: object) =>
    endpoint.handler(await createLocalReq({ user: user as never }, payload));

  it('NT14 the test action: one line per channel, once a minute; others get the 404 of the hidden global', async () => {
    const endpoint = testAction();
    const first = await callAs(endpoint, admin);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      lines: ['ایمیل: خاموش.', 'تلگرام: خاموش.', 'پیامک: خاموش.'],
      message: 'ایمیل: خاموش. تلگرام: خاموش. پیامک: خاموش.',
      level: 'info',
    });
    expect((await callAs(endpoint, admin)).status).toBe(429);
    expect((await callAs(endpoint, editor)).status).toBe(404);
    expect((await callAs(endpoint, unverified())).status).toBe(404);
  });

  it('NT15 a switch that is on but cannot send says so, as an error, never «خاموش»', async () => {
    // Without a user the 9.7 rule does not apply: the state an env change after saving leaves.
    await payload.updateGlobal({
      slug: 'notifier',
      data: { mail: { enabled: true, recipients: [{ email: 'reception@sefid.test' }] } },
      overrideAccess: true,
    });
    try {
      const body = (await (await callAs(testAction(), admin)).json()) as {
        lines: string[];
        level: string;
      };
      expect(body.lines[0]).toBe(
        'ایمیل: روشن است ولی SMTP یا گیرنده تنظیم نشده؛ ایمیلی فرستاده نمی‌شود.',
      );
      expect(body.level).toBe('error');
    } finally {
      await payload.updateGlobal({
        slug: 'notifier',
        data: { mail: { enabled: false, recipients: [] } },
        overrideAccess: true,
      });
    }
  });
});
