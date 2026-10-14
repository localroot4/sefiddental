import { schedulePublishHandler } from '@payloadcms/ui/utilities/schedulePublishHandler';
import { createLocalReq, type Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { adminServerFunctions } from '@/admin/schedulePublish';
import { runCronTick } from '@/lib/http/cron';

import { getTestPayload, publishedService, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;

// The function the admin's `schedule-publish` call reaches, chosen as handleServerFunctions does.
const schedulePublish =
  (adminServerFunctions as Record<string, typeof schedulePublishHandler>)['schedule-publish'] ??
  schedulePublishHandler;

async function call(user: object, args: Record<string, unknown>) {
  const req = await createLocalReq({ user: user as never }, payload);
  return schedulePublish({ ...args, req } as never);
}

/** The schedulePublish job of one document (job ids are reused on SQLite, so match the input). */
async function jobFor(doc: { relationTo: string; value: string }) {
  const { docs } = await payload.find({
    collection: 'payload-jobs',
    where: { taskSlug: { equals: 'schedulePublish' } },
    limit: 0,
    depth: 0,
  });
  return docs.find((job) => {
    const input = job.input as { doc?: { relationTo?: string; value?: unknown } } | null;
    return input?.doc?.relationTo === doc.relationTo && String(input.doc.value) === doc.value;
  });
}

const scheduledJobs = () =>
  payload.count({ collection: 'payload-jobs', where: { taskSlug: { equals: 'schedulePublish' } } });

describe('scheduled publish entry point (SEC-AUTH-1, SEC-AUTH-2)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
  });

  it('SA1 a password-only session of an enrolled admin cannot queue a schedule', async () => {
    const { service } = await publishedService(payload);
    const before = (await scheduledJobs()).totalDocs;
    const passwordOnly = { ...admin, _strategy: 'local-jwt', hasTotp: true };
    await expect(
      call(passwordOnly, {
        type: 'unpublish',
        doc: { relationTo: 'services', value: String(service.id) },
        date: new Date(Date.now() - 1000),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await scheduledJobs()).totalDocs).toBe(before);
  });

  it('SA2 a job that carries a user runs as that user only inside the cron job runner', async () => {
    const draft = await payload.create({
      collection: 'testimonials',
      data: {
        patientLabel: `م. ${unique()}`,
        type: 'text',
        quote: 'از برخورد پذیرش راضی بودم.',
        consentConfirmed: true,
      },
      draft: true,
    });
    await payload.jobs.queue({
      task: 'schedulePublish',
      input: {
        type: 'publish',
        doc: { relationTo: 'testimonials', value: String(draft.id) },
        user: { relationTo: 'users', value: editor.id },
      } as never,
      waitUntil: new Date(Date.now() - 1000),
    });
    // Payload's own runner (no cron path): the user has no strategy, so TOTP still applies.
    const result = await payload.jobs.run({ allQueues: true, limit: 20 });
    expect(Object.values(result.jobStatus ?? {}).map((s) => s.status)).not.toContain('success');
    const after = await payload.findByID({ collection: 'testimonials', id: draft.id, depth: 0 });
    expect(after._status).toBe('draft');
  });

  it('SA3 an editor cannot delete an admin schedule of an admin-only document', async () => {
    const { service } = await publishedService(payload);
    const target = { relationTo: 'services', value: String(service.id) };
    const later = new Date(Date.now() + 24 * 3600_000);
    expect(await call(admin, { type: 'unpublish', doc: target, date: later })).toMatchObject({
      message: expect.any(String),
    });
    const job = await jobFor(target);
    expect(job).toBeTruthy();
    await expect(call(editor, { deleteID: job?.id })).rejects.toMatchObject({ status: 403 });
    expect((await jobFor(target))?.id).toBe(job?.id);
    await call(admin, { deleteID: job?.id });
    expect(await jobFor(target)).toBeUndefined();
  });

  it('SA4 the cron tick still publishes as the scheduling editor', async () => {
    const draft = await payload.create({
      collection: 'testimonials',
      data: {
        patientLabel: `م. ${unique()}`,
        type: 'text',
        quote: 'نوبت به‌موقع بود.',
        consentConfirmed: true,
      },
      draft: true,
    });
    await call(editor, {
      type: 'publish',
      doc: { relationTo: 'testimonials', value: String(draft.id) },
      date: new Date(Date.now() - 1000),
    });
    const summary = await runCronTick(payload);
    expect(summary.failed).toBe(0);
    const after = await payload.findByID({ collection: 'testimonials', id: draft.id, depth: 0 });
    expect(after._status).toBe('published');
  });
});
