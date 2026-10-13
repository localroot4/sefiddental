import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { normalizeEvent } from '@/lib/events/allowlist';
import { EVENTS_DAILY_TABLE, incrementEventDaily } from '@/lib/events/increment';

import { getTestPayload, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

const counter = async (date: string) =>
  (
    await payload.find({
      collection: 'events-daily',
      where: { date: { equals: date } },
      depth: 0,
      pagination: false,
    })
  ).docs;

describe('events-daily counters (spec-data 4.2)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('EV1 the drizzle table key is events_daily', () => {
    expect(Object.keys((payload.db as unknown as { tables: object }).tables)).toContain(
      EVENTS_DAILY_TABLE,
    );
  });

  it('EV2 fifty concurrent increments of one key give one row with count 50', async () => {
    const date = `t-${unique()}`;
    const row = normalizeEvent({ event: 'call_click', location: 'header' }, date, new Set())!;
    await Promise.all(Array.from({ length: 50 }, () => incrementEventDaily(payload, row)));
    const rows = await counter(date);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'call_click',
      location: 'header',
      pageType: 'other',
      serviceKey: 'none',
      count: 50,
    });
  });

  it('EV3 each dimension set is its own row', async () => {
    const date = `t-${unique()}`;
    await incrementEventDaily(payload, normalizeEvent({ event: 'call_click' }, date, new Set())!);
    await incrementEventDaily(
      payload,
      normalizeEvent({ event: 'call_click', location: 'footer' }, date, new Set())!,
    );
    await incrementEventDaily(
      payload,
      normalizeEvent({ event: 'whatsapp_click' }, date, new Set())!,
    );
    expect((await counter(date)).map((r) => r.count)).toEqual([1, 1, 1]);
  });
});
