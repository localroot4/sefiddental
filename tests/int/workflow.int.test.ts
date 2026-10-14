import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runCronTick } from '@/lib/http/cron';

import { getTestPayload, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let editor: StaffUser;

describe('scheduled publish and booking search', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ editor } = await staffUsers(payload));
  });

  it('SP1 a scheduled publish runs as the scheduling editor (totpUnlessServerUser)', async () => {
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
    // The admin's schedule handler queues exactly this (spec-data P7).
    await payload.jobs.queue({
      task: 'schedulePublish',
      // The admin sends the id as a string (payload versions/schedule/job.js coerces it back).
      input: {
        type: 'publish',
        doc: { relationTo: 'testimonials', value: String(draft.id) },
        user: { relationTo: 'users', value: editor.id },
      } as never,
      waitUntil: new Date(Date.now() - 1000),
    });
    // The site's scheduler: only its job runner lets the scheduling user skip TOTP (SEC-AUTH-1).
    expect((await runCronTick(payload)).failed).toBe(0);
    const after = await payload.findByID({ collection: 'testimonials', id: draft.id, depth: 0 });
    expect(after._status).toBe('published');
  });

  it('BS1 the admin list search finds a booking from Persian digits', async () => {
    const tail = String(Math.floor(1000 + Math.random() * 8999));
    const booking = await payload.create({
      collection: 'bookings',
      data: { phone: `0912777${tail}` } as never,
    });
    const persian = `۰۹۱۲ ۷۷۷ ${tail.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] as string)}`;
    const found = await payload.find({
      collection: 'bookings',
      where: { or: [{ phoneNational: { like: persian } }, { name: { like: persian } }] },
      depth: 0,
    });
    expect(found.docs.map((d) => d.id)).toContain(booking.id);
  });
});
