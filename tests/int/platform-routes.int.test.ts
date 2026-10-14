// Lane P system routes against Payload on the int database (spec-platform 10.2-10.3, 11.1-11.3;
// freeze decision 6). Route handlers are called directly with Request objects.
import type { Payload } from 'payload';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { readEnv } from '@/lib/env';
import { zonedDateKey } from '@/lib/jalali';

import { getTestPayload, publishedService, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let editor: StaffUser;

const site = () => readEnv().siteUrl;

describe('platform routes on Payload', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ editor } = await staffUsers(payload));
  });
  afterEach(() => vi.restoreAllMocks());

  it('PH1 /api/health: 200 with the database check; a database that never answers gives 503 in 2.5 s', async () => {
    vi.resetModules();
    const up = await (await import('@/app/(site)/api/health/route')).GET();
    expect(up.status).toBe(200);
    expect(await up.json()).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'ok', latencyMs: expect.any(Number) } },
    });

    // A stopped database, simulated: the probe's count call never settles.
    vi.resetModules();
    vi.spyOn(payload, 'count').mockReturnValue(new Promise(() => {}));
    const { GET, HEAD } = await import('@/app/(site)/api/health/route');
    const started = Date.now();
    const down = await GET();
    expect(Date.now() - started).toBeLessThan(2500);
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ status: 'down' });
    expect((await HEAD()).status).toBe(503);
  });

  it('PE1 /api/events increments the Tehran-day row atomically and stores no client data', async () => {
    const { service } = await publishedService(payload);
    const { POST } = await import('@/app/(site)/api/events/route');
    const beacon = (body: unknown) =>
      POST(
        new Request(`${site()}/api/events`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'text/plain', origin: site(), 'x-forwarded-for': '5.6.7.8' },
        }),
      );
    const row = {
      event: 'call_click',
      location: 'header',
      pageType: 'service',
      serviceKey: service.key,
    };
    const counts = async () =>
      (
        await payload.find({
          collection: 'events-daily',
          where: { serviceKey: { equals: service.key } },
          depth: 0,
          pagination: false,
        })
      ).docs;

    const first = await beacon(row);
    expect(first.status).toBe(204);
    expect(first.headers.get('set-cookie')).toBeNull();
    expect(await counts()).toMatchObject([{ date: zonedDateKey(new Date()), ...row, count: 1 }]);
    expect((await beacon([row, row, { ...row, event: 'evil' }])).status).toBe(204);
    const [stored] = await counts();
    expect(stored).toMatchObject({ count: 3 });
    // Only the five dimensions and the counter exist on the row: no IP, no cookie, no user agent.
    expect(Object.keys(stored!).sort()).toEqual(
      [
        'count',
        'createdAt',
        'date',
        'event',
        'id',
        'location',
        'pageType',
        'serviceKey',
        'updatedAt',
      ].sort(),
    );
  });

  it('PE2 /api/events rejects cross-site (403) and the 61st event of a minute (429) without writing', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/(site)/api/events/route');
    const date = zonedDateKey(new Date());
    const total = async () =>
      (
        await payload.find({
          collection: 'events-daily',
          where: { and: [{ date: { equals: date } }, { event: { equals: 'save_contact' } }] },
          depth: 0,
          pagination: false,
        })
      ).docs.reduce((sum, doc) => sum + doc.count, 0);
    const send = (body: unknown, headers: Record<string, string> = {}) =>
      POST(
        new Request(`${site()}/api/events`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers,
        }),
      );

    const before = await total();
    const crossSite = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' };
    expect((await send({ event: 'save_contact' }, crossSite)).status).toBe(403);
    const batch = Array.from({ length: 10 }, () => ({ event: 'save_contact' }));
    for (let i = 0; i < 6; i += 1) expect((await send(batch)).status).toBe(204);
    expect((await send({ event: 'save_contact' })).status).toBe(429);
    expect((await total()) - before).toBe(60);
  });

  it('PC1 /api/cron/tick: 401 without the bearer; with it, runs a due publish and records the run', async () => {
    const { GET } = await import('@/app/(site)/api/cron/tick/route');
    const tick = (authorization?: string) =>
      GET(
        new Request(`${site()}/api/cron/tick`, {
          headers: authorization ? { authorization } : {},
        }),
      );
    expect((await tick()).status).toBe(401);
    expect((await tick('Bearer wrong')).status).toBe(401);

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

    const bearer = `Bearer ${readEnv().cronSecret}`;
    const [a, b] = await Promise.all([tick(bearer), tick(bearer)]);
    const summary = await a.json();
    expect(summary).toEqual(await b.json());
    expect(summary).toEqual({
      ranJobs: expect.any(Number),
      failed: 0,
      remaining: expect.any(Number),
      scheduled: expect.any(Number),
      durationMs: expect.any(Number),
    });
    expect(summary.ranJobs).toBeGreaterThanOrEqual(1);
    const published = await payload.findByID({
      collection: 'testimonials',
      id: draft.id,
      depth: 0,
    });
    expect(published._status).toBe('published');

    const state = await payload.findGlobal({ slug: 'system-state', depth: 0 });
    expect(state).toMatchObject({
      lastCronRanJobs: summary.ranJobs,
      lastCronFailed: 0,
      lastCronError: null,
    });
    expect(Date.now() - Date.parse(state.lastCronRunAt!)).toBeLessThan(60_000);

    // Idempotent: the job is done, so the next tick runs nothing and still records a run.
    const again = await (await tick(bearer)).json();
    expect(again).toMatchObject({ ranJobs: 0, failed: 0 });
  });

  it('PI1 /api/internal/*: 404 without the token; the proxy reads active rows and counts hits', async () => {
    const from = `/r-${unique()}`;
    await payload.create({ collection: 'redirects', data: { from, to: '/خدمات' } as never });
    const token = { 'x-internal-token': readEnv().internalApiToken };
    const config = await import('@/app/(site)/api/internal/proxy-config/route');
    const hit = await import('@/app/(site)/api/internal/redirect-hit/route');
    const url = (path: string) => `${readEnv().internalOrigin}${path}`;

    expect((await config.GET(new Request(url('/api/internal/proxy-config')))).status).toBe(404);
    const res = await config.GET(
      new Request(url('/api/internal/proxy-config'), { headers: token }),
    );
    const body = (await res.json()) as { v: number; redirects: unknown[][] };
    expect(body.v).toBe(1);
    expect(body.redirects).toContainEqual([from, '/خدمات', 301]);

    const post = (headers: Record<string, string>) =>
      hit.POST(
        new Request(url('/api/internal/redirect-hit'), {
          method: 'POST',
          body: JSON.stringify({ from }),
          headers,
        }),
      );
    expect((await post({})).status).toBe(404);
    expect((await post(token)).status).toBe(204);
    expect((await post(token)).status).toBe(204);
    const [row] = (
      await payload.find({ collection: 'redirects', where: { from: { equals: from } }, depth: 0 })
    ).docs;
    expect(row).toMatchObject({ hits: 2 });
    expect(row?.lastHitAt).toBeTruthy();
  });
});
