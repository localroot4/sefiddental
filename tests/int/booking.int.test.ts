import { randomInt } from 'node:crypto';

import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createBookingHandler, createEmergencyHandler } from '@/lib/booking/handler';
import { payloadBookingStore } from '@/lib/booking/store';
import { csrfFor, FORM_COOKIE, issueTimeToken } from '@/lib/formTokens';
import type { ClinicHours } from '@/lib/hoursState';
import { runCronTick } from '@/lib/http/cron';
import { readEnv } from '@/lib/env';
import { createLogger, log } from '@/lib/log/logger';
import { createNotifier } from '@/lib/notify';
import { claimSms, destinationHash, releaseSms, SMS_CAP_WINDOW_MS } from '@/lib/notify/smsThrottle';
import { runNotifyJob } from '@/lib/notify/task';
import type { NotifyEvent } from '@/lib/notify/types';

import { getTestPayload, type StaffUser, staffUsers } from './helpers';

// The task reads the Farapayamak values from the process environment (readEnv, memoized per file).
vi.hoisted(() => {
  process.env.FARAPAYAMAK_USERNAME = 'int-user';
  process.env.FARAPAYAMAK_PASSWORD = 'int-password';
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let admin: StaffUser;

const K = 'k'.repeat(48);
const SID = 'S'.repeat(43);
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  holidays: [],
  noteFa: '',
};
const HOUR = 60 * 60_000;

/** A mobile number no other run uses (0999 prefix, conversion.md 5.1 accepts 099x). */
const uniquePhone = () => `0999${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
const uniqueIp = () =>
  `2001:db8:${randomInt(0, 0xffff).toString(16)}:${randomInt(0, 0xffff).toString(16)}::1`;
const e164 = (national: string) => `+98${national.slice(1)}`;

function harness(start = Date.now()) {
  let now = start;
  const notified: NotifyEvent[] = [];
  const lines: string[] = [];
  const deps = {
    env: () => ({
      ...readEnv(),
      formTokenSecrets: [K],
      formTokenTtlSeconds: 7200,
      siteUrl: 'https://sefiddental.ir',
      trustProxyHeaders: true,
      trustedProxyHops: 1,
    }),
    store: payloadBookingStore(async () => payload),
    loadHours: async () => ({ hours: HOURS, options: { callbackMinutes: 10 } }),
    notify: vi.fn(async (event: NotifyEvent) => void notified.push(event)),
    countEvent: async () => undefined,
    logger: createLogger(
      { logLevel: 'info', gitSha: 'int', nodeEnv: 'test' },
      { write: (line: string) => void lines.push(line) },
    ),
    now: () => now,
  };
  return {
    booking: createBookingHandler({
      ...deps,
      catalog: async () => ({ services: new Map(), tiers: new Map(), doctors: new Map() }),
    }),
    emergency: createEmergencyHandler({ ...deps, emergencyEnabled: async () => true }),
    deps,
    notified,
    lines,
    advance: (ms: number) => (now += ms),
    now: () => now,
  };
}

function post(
  nowMs: number,
  fields: Record<string, string | string[]>,
  ip: string,
  path = '/api/booking',
) {
  const body = new URLSearchParams();
  const all = { csrf: csrfFor(K, SID), ts: issueTimeToken(K, SID, nowMs - 5000), ...fields };
  for (const [key, value] of Object.entries(all)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
  }
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    body,
    headers: {
      accept: 'application/json',
      cookie: `${FORM_COOKIE}=${SID}`,
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': ip,
      'x-request-id': 'req-int-0001',
    },
  });
}

const rowsOf = async (phone: string) =>
  (
    await payload.find({
      collection: 'bookings',
      where: { phone: { equals: e164(phone) } },
      sort: 'createdAt',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs;

describe('booking pipeline on the database (booking-pipeline 12.2, emergency.md 16)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin } = await staffUsers(payload));
  });

  it('BI-CREATE the stored row gets its hook fields; the audit row names #id and no phone', async () => {
    const t = harness();
    const phone = uniquePhone();
    const res = await t.booking(
      post(t.now(), { phone, name: 'سارا', note: 'درد دارم' }, uniqueIp()),
    );
    expect((await res.json()).state).toBe('success');
    const [row] = await rowsOf(phone);
    expect(row).toMatchObject({
      status: 'new',
      kind: 'regular',
      phoneNational: phone,
      urgencyRank: 1,
      formLocation: 'page',
      listTitle: expect.stringContaining('سارا'),
    });
    expect(row?.callbackDueAt).toEqual(expect.any(String));
    expect(row?.ipHash).toMatch(/^[a-f0-9]{64}$/);
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ entitySlug: { equals: 'bookings' } }, { docId: { equals: String(row?.id) } }],
      },
      depth: 0,
      overrideAccess: true,
    });
    const text = JSON.stringify(audit.docs);
    expect(text).toContain(`#${row?.id}`);
    expect(text).not.toContain(phone.slice(1));
    expect(text).not.toContain('سارا');
  });

  it('BI-QUERY the phone and IP limits read the database: they hold across a restart', async () => {
    const start = Date.now();
    const phone = uniquePhone();
    const first = harness(start);
    for (let i = 0; i < 3; i += 1) {
      await first.booking(post(first.now(), { phone }, uniqueIp()));
      first.advance(HOUR);
    }
    // A new handler instance has no memory of the first one.
    const restarted = harness(start + 3 * HOUR);
    const fourth = await restarted.booking(
      post(restarted.now(), { phone, note: 'چهارم' }, uniqueIp()),
    );
    expect((await fourth.json()).state).toBe('neutral');
    const rows = await rowsOf(phone);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.duplicateSubmissions).toEqual([expect.objectContaining({ note: 'چهارم' })]);

    const ip = uniqueIp();
    for (let i = 0; i < 10; i += 1)
      await first.booking(post(first.now(), { phone: uniquePhone() }, ip));
    const eleventh = uniquePhone();
    await harness(first.now()).booking(post(first.now(), { phone: eleventh }, ip));
    expect((await rowsOf(eleventh))[0]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
  });

  it('BI-SUS suspicious rows count toward neither the phone limit nor the duplicate window (Q4)', async () => {
    const t = harness();
    const phone = uniquePhone();
    for (let i = 0; i < 4; i += 1) {
      await t.booking(post(t.now(), { phone, extra_7: 'bot' }, uniqueIp()));
    }
    const real = await t.booking(post(t.now(), { phone }, uniqueIp()));
    expect((await real.json()).state).toBe('success');
    expect((await rowsOf(phone)).map((r) => r.status)).toEqual([
      'suspicious',
      'suspicious',
      'suspicious',
      'suspicious',
      'new',
    ]);
  });

  it('BI-DUP an appended duplicate keeps every earlier value and entry', async () => {
    const t = harness();
    const phone = uniquePhone();
    await t.booking(post(t.now(), { phone, name: 'اول', time_pref: 'morning' }, uniqueIp()));
    t.advance(60_000);
    await t.booking(post(t.now(), { phone, name: 'دوم', time_pref: 'evening' }, uniqueIp()));
    t.advance(60_000);
    await t.booking(post(t.now(), { phone, note: 'سوم' }, uniqueIp()));
    const [row, ...rest] = await rowsOf(phone);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ name: 'اول', preferredTime: 'morning', note: null });
    expect(row?.duplicateSubmissions?.map((d) => [d.name, d.preferredTime, d.note])).toEqual([
      ['دوم', 'evening', null],
      [null, null, 'سوم'],
    ]);
  });

  it('BI-RESTORE a suspicious row restored to new by staff gains the restored flag', async () => {
    const t = harness();
    const phone = uniquePhone();
    await t.booking(post(t.now(), { phone, extra_7: 'bot' }, uniqueIp()));
    const [row] = await rowsOf(phone);
    expect(row).toMatchObject({ status: 'suspicious', flags: ['honeypot'] });
    const restored = await payload.update({
      collection: 'bookings',
      id: row!.id,
      data: { status: 'new' },
      user: admin,
    });
    expect(restored.flags).toEqual(expect.arrayContaining(['honeypot', 'restored']));
    expect(t.notified).toEqual([]);
  });

  it('T-EM7 an emergency is stored with triage and rank 0, before the notifier runs', async () => {
    const t = harness();
    const phone = uniquePhone();
    let kindAtNotify: unknown = null;
    t.deps.notify.mockImplementationOnce(async (event: NotifyEvent) => {
      // Persist first: the row is readable when the notifier is called.
      const id = event.type === 'booking' ? event.bookingId : 0;
      kindAtNotify = (
        await payload.findByID({ collection: 'bookings', id, depth: 0, overrideAccess: true })
      ).kind;
      t.notified.push(event);
    });
    const res = await t.emergency(
      post(t.now(), { phone, triage: ['bleeding', 'swelling'] }, uniqueIp(), '/api/emergency'),
    );
    expect((await res.json()).state).toBe('success');
    const [row] = await rowsOf(phone);
    expect(row).toMatchObject({
      kind: 'emergency',
      triage: ['swelling', 'bleeding'],
      formLocation: 'emergency',
      urgencyRank: 0,
    });
    expect(row?.callbackDueAt).toEqual(expect.any(String));
    expect(t.notified).toEqual([
      { type: 'booking', bookingId: row?.id, requestId: 'req-int-0001' },
    ]);
    expect(kindAtNotify).toBe('emergency');
    expect(t.lines.join('\n')).toContain('req-int-0001');
    expect(t.lines.join('\n')).not.toContain(phone.slice(1));
  });

  it('T-EM8 a repeat emergency keeps its triage in the first row; 24 h later a new row', async () => {
    const t = harness();
    const phone = uniquePhone();
    const em = (triage: string) =>
      t.emergency(post(t.now(), { phone, triage }, uniqueIp(), '/api/emergency'));
    await em('broken');
    t.advance(23 * HOUR);
    expect((await (await em('avulsion')).json()).state).toBe('neutral');
    let rows = await rowsOf(phone);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.duplicateSubmissions?.map((d) => (d as { triage?: string[] }).triage)).toEqual([
      ['avulsion'],
    ]);
    t.advance(HOUR + 60_000);
    expect((await (await em('broken')).json()).state).toBe('success');
    rows = await rowsOf(phone);
    expect(rows).toHaveLength(2);
  });

  it('BI-IP-KINDS the IP rules read both kinds on the database: 4th emergency flagged, 11th request suspicious', async () => {
    const t = harness();
    const ip = uniqueIp();
    const phones = Array.from({ length: 11 }, () => uniquePhone());
    for (const phone of phones.slice(0, 4)) {
      await t.emergency(post(t.now(), { phone, triage: 'broken' }, ip, '/api/emergency'));
    }
    expect((await rowsOf(phones[3]!))[0]).toMatchObject({
      status: 'new',
      flags: ['emergency_ip_rate'],
    });
    for (const phone of phones.slice(4, 10)) await t.booking(post(t.now(), { phone }, ip));
    await t.booking(post(t.now(), { phone: phones[10]! }, ip));
    expect((await rowsOf(phones[9]!))[0]?.status).toBe('new');
    expect((await rowsOf(phones[10]!))[0]).toMatchObject({
      status: 'suspicious',
      flags: ['ip_rate'],
    });
  });

  it('BI-APPEND-IP appended entries keep their IP hash and count toward the per-IP hour', async () => {
    const t = harness();
    const ip = uniqueIp();
    const phone = uniquePhone();
    for (let i = 0; i < 10; i += 1) await t.booking(post(t.now(), { phone, note: `n${i}` }, ip));
    const [row] = await rowsOf(phone);
    expect(row?.duplicateSubmissions).toHaveLength(9);
    const entry = row?.duplicateSubmissions?.[0] as { ipHash?: string } | undefined;
    expect(entry?.ipHash).toBe(row?.ipHash);
    const other = uniquePhone();
    await t.booking(post(t.now(), { phone: other }, ip));
    expect((await rowsOf(other))[0]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
  });

  it('BI-CLOSED a repeat emergency after staff closed the first one is a new row', async () => {
    const t = harness();
    const phone = uniquePhone();
    const em = () =>
      t.emergency(post(t.now(), { phone, triage: 'swelling' }, uniqueIp(), '/api/emergency'));
    await em();
    const [first] = await rowsOf(phone);
    await payload.update({
      collection: 'bookings',
      id: first!.id,
      data: { status: 'done' },
      user: admin,
    });
    t.advance(HOUR);
    expect((await (await em()).json()).state).toBe('success');
    const rows = await rowsOf(phone);
    expect(rows.map((r) => [r.status, r.duplicateSubmissions?.length ?? 0])).toEqual([
      ['done', 0],
      ['new', 0],
    ]);
  });

  it('T-EM12 a phone whose emergency priority was removed ranks its next emergency as regular', async () => {
    const t = harness();
    const phone = uniquePhone();
    await payload.create({
      collection: 'bookings',
      data: {
        phone,
        phoneNational: phone,
        kind: 'regular',
        status: 'done',
        flags: ['emergency_priority_removed'],
      },
      user: admin,
    });
    await t.emergency(post(t.now(), { phone, triage: 'swelling' }, uniqueIp(), '/api/emergency'));
    const rows = await rowsOf(phone);
    expect(rows.find((r) => r.kind === 'emergency')?.urgencyRank).toBe(1);
  });
});

describe('notify jobs and the SMS cap on the database (admin-notify.md 12)', () => {
  beforeAll(async () => {
    payload ??= await getTestPayload();
  });
  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'notifier',
      data: {
        sms: {
          enabled: false,
          senderNumber: null,
          adminRecipients: [],
          patientConfirmation: false,
        },
      },
      overrideAccess: true,
    });
  });

  it('NT9 the patient SMS: claimed before the send, freed on a failure, skipped when capped', async () => {
    await payload.updateGlobal({
      slug: 'notifier',
      data: { sms: { enabled: true, senderNumber: '3000123', patientConfirmation: true } },
      overrideAccess: true,
    });
    const phone = uniquePhone();
    const booking = await payload.create({
      collection: 'bookings',
      data: { phone: e164(phone), phoneNational: phone, kind: 'regular', status: 'new' },
      overrideAccess: true,
    });
    const deps = { payload, env: readEnv(), now: Date.now };
    const input = {
      event: { type: 'booking', bookingId: booking.id },
      channel: 'sms_patient',
    } as const;
    // The provider call fails (scaffold): the claim is released, so a retry may claim again.
    await expect(runNotifyJob(input, deps)).rejects.toThrow('پیامک هنوز راه‌اندازی نشده است.');
    const hash = destinationHash(e164(phone), readEnv().ipHashSecret);
    expect(await claimSms(payload, hash, Date.now())).not.toBeNull();
    // Capped: skipped before the provider is called; the line names the booking, not the number.
    const info = vi.spyOn(log, 'info');
    await expect(runNotifyJob(input, deps)).resolves.toEqual({ status: 'skipped', reason: 'cap' });
    expect(info).toHaveBeenCalledWith({ msg: 'sms_capped', bookingId: booking.id });
    info.mockRestore();
  });

  it('NT12 BI-JOB a failing job retries with growing waits, then stays failed; no phone in it', async () => {
    const adminPhone = '+989120001122';
    const phoneOfJob = uniquePhone();
    await payload.updateGlobal({
      slug: 'notifier',
      data: {
        // One admin job only: the patient message (NT9) stays off.
        sms: {
          enabled: true,
          senderNumber: '3000123',
          adminRecipients: [{ phone: adminPhone }],
          patientConfirmation: false,
        },
      },
      overrideAccess: true,
    });
    const notifier = createNotifier({
      payload: async () => payload,
      env: readEnv,
      logger: createLogger({ logLevel: 'fatal', gitSha: 'int', nodeEnv: 'test' }),
      now: Date.now,
    });
    const booking = await payload.create({
      collection: 'bookings',
      data: { phone: e164(phoneOfJob), phoneNational: phoneOfJob, kind: 'regular', status: 'new' },
      overrideAccess: true,
    });
    await notifier.notify({ type: 'booking', bookingId: booking.id, requestId: 'req-int-job' });

    const findJob = async () =>
      (
        await payload.find({
          collection: 'payload-jobs',
          where: { taskSlug: { equals: 'notify' } },
          depth: 0,
          limit: 0,
        })
      ).docs.find((job) => {
        const input = job.input as { event?: { bookingId?: unknown } } | null;
        return String(input?.event?.bookingId) === String(booking.id);
      });
    const job = await findJob();
    expect(job).toBeDefined();
    expect(JSON.stringify(job?.input)).not.toContain(phoneOfJob.slice(1));
    expect(JSON.stringify(job?.input)).not.toContain('9120001122');

    const errorSpy = vi.spyOn(log, 'error');
    const warnSpy = vi.spyOn(log, 'warn');
    const waits: number[] = [];
    for (let run = 0; run < 8; run += 1) {
      const before = Date.now();
      await runCronTick(payload);
      const current = await findJob();
      if (!current || current.hasError) break;
      waits.push(Math.round((Date.parse(current.waitUntil ?? '') - before) / 60_000));
      // Skip the wait instead of sleeping.
      await payload.update({
        collection: 'payload-jobs',
        id: current.id,
        data: { waitUntil: new Date(Date.now() - 1000).toISOString() },
        overrideAccess: true,
      });
    }
    const failed = await findJob();
    expect(failed?.hasError).toBe(true);
    expect(failed?.totalTried).toBe(6);
    expect(waits).toEqual([1, 2, 4, 8, 16]);
    // Five failed tries warn; the last one is the error.
    const notifyFailed = (spy: typeof errorSpy) =>
      spy.mock.calls.filter(([obj]) => (obj as { msg?: string })?.msg === 'notify_failed');
    expect(notifyFailed(warnSpy)).toHaveLength(5);
    expect(notifyFailed(errorSpy)).toHaveLength(1);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    expect(JSON.stringify(failed?.log ?? [])).not.toMatch(/9120001122/);
    // The booking itself is untouched by the failed notification.
    expect(
      (await payload.findByID({ collection: 'bookings', id: booking.id, overrideAccess: true }))
        .status,
    ).toBe('new');
  });

  it('NT8 one SMS per destination per 24 h: concurrent claims let one through; release frees it', async () => {
    const secret = readEnv().ipHashSecret;
    const hash = destinationHash(e164(uniquePhone()), secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const now = Date.now();
    const claims = await Promise.all([1, 2, 3, 4, 5].map(() => claimSms(payload, hash, now)));
    expect(claims.filter((c) => c !== null)).toHaveLength(1);
    expect(await claimSms(payload, hash, now + SMS_CAP_WINDOW_MS - 1)).toBeNull();
    const later = await claimSms(payload, hash, now + SMS_CAP_WINDOW_MS + 1);
    expect(later).not.toBeNull();
    await releaseSms(payload, hash, later!);
    expect(await claimSms(payload, hash, now + SMS_CAP_WINDOW_MS + 2)).not.toBeNull();
    // Only the hash is stored.
    // The slug joins the generated types with this phase's type generation.
    const { docs } = await (
      payload as unknown as { find: (args: object) => Promise<{ docs: unknown[] }> }
    ).find({
      collection: 'sms-throttle',
      where: { destinationHash: { equals: hash } },
      overrideAccess: true,
      depth: 0,
    });
    expect(docs).toHaveLength(1);
    expect(JSON.stringify(docs)).not.toMatch(/\+98|0999/);
  });
});
