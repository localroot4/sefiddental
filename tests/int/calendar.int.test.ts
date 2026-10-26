// The editorial calendar against Payload's real job queue (H12, H13; T-AD26 covers the view in
// the admin): a scheduled publish waits on its day, a refused one stays as a failed row with
// the block messages until its document is published.
import { schedulePublishHandler } from '@payloadcms/ui/utilities/schedulePublishHandler';
import { createLocalReq, type Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCalendar } from '@/admin/calendar';
import { adminServerFunctions } from '@/admin/schedulePublish';
import { adminText } from '@/i18n/fa-admin';
import { runCronTick } from '@/lib/http/cron';
import { ADMIN_ROUTE } from '@/lib/paths';

import { getTestPayload, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let editor: StaffUser;

const schedulePublish =
  (adminServerFunctions as Record<string, typeof schedulePublishHandler>)['schedule-publish'] ??
  schedulePublishHandler;

async function schedule(id: number | string, date: Date) {
  const req = await createLocalReq({ user: editor as never }, payload);
  return schedulePublish({
    type: 'publish',
    doc: { relationTo: 'articles', value: String(id) },
    date,
    req,
  } as never);
}

const draftArticle = (title: string) =>
  payload.create({ collection: 'articles', data: { title } as never, draft: true });

describe('editorial calendar on the job queue', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ editor } = await staffUsers(payload));
  });

  it('CAL-I1 a pending publish is scheduled; a refused one is failed with the Persian block messages', async () => {
    const later = await draftArticle(`مقالهٔ زمان‌بندی‌شده ${unique()}`);
    const broken = await draftArticle(`مقالهٔ ناقص ${unique()}`);
    await schedule(later.id, new Date(Date.now() + 3 * 86_400_000));
    await schedule(broken.id, new Date(Date.now() - 1000));
    const tick = await runCronTick(payload);
    expect(tick.failed).toBeGreaterThan(0);

    const { items, drafts } = await loadCalendar(payload, ['articles']);
    expect(items.find((i) => i.id === String(later.id))).toMatchObject({
      kind: 'scheduled',
      title: later.title,
      href: `${ADMIN_ROUTE}/collections/articles/${later.id}`,
    });
    const failed = items.find((i) => i.id === String(broken.id));
    expect(failed).toMatchObject({ kind: 'failed', title: broken.title });
    // The publish gate's own messages (MODEL), never Payload's English summary.
    expect(failed?.message).toMatch(/[\u0600-\u06FF]/);
    expect(failed?.message).not.toMatch(/[A-Za-z]{3}/);
    expect(failed?.message).not.toBe(adminText('admin.calendar.failedNoMessage'));
    // What to fix, not Payload's «فیلدهای زیر نامعتبر هستند» list of field names.
    expect(failed?.message).toContain('توضیح سئو را بنویسید');
    // H12: the row says what to fix, so Payload's bare required-field line carries its field.
    expect(failed?.message).not.toMatch(/(^|\. )این فیلد الزامی است/);
    expect(drafts.map((d) => d.id)).toEqual(expect.arrayContaining([later.id, broken.id]));
  });

  it('CAL-I2 an editor’s calendar leaves out what the editor’s navigation hides', async () => {
    const { items } = await loadCalendar(payload, ['bookings', 'tags', 'media']);
    expect(items.filter((i) => i.collection === 'articles')).toEqual([]);
  });
});
