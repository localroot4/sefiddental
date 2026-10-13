import { sql } from '@payloadcms/db-postgres/drizzle';
import type { Payload } from 'payload';

import { cachedRead } from '@/lib/data/cache';
import { drizzleTable } from '@/lib/data/drizzle';
import { getPayloadClient } from '@/lib/data/payload';
import { colTag } from '@/lib/data/tags';

import type { EventRow } from './allowlist';

/** Drizzle table key of the `events-daily` collection (asserted in tests/int/events.int.test.ts). */
export const EVENTS_DAILY_TABLE = 'events_daily';

/**
 * One atomic upsert per beacon: insert the counter row with 1, or add 1 on the unique key
 * (spec-data 4.2). No Payload hooks, versions, audit or revalidation per beacon.
 */
export async function incrementEventDaily(payload: Payload, row: EventRow): Promise<void> {
  const { db, table } = drizzleTable(payload, EVENTS_DAILY_TABLE);
  const now = new Date().toISOString();
  await db.drizzle
    .insert(table)
    .values({ ...row, count: 1, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [table.date, table.event, table.location, table.pageType, table.serviceKey],
      set: { count: sql`${table.count} + 1`, updatedAt: now },
    });
}

/** Keys of published services, for `normalizeEvent`. */
export async function getServiceKeys(): Promise<ReadonlySet<string>> {
  const keys = await cachedRead('getServiceKeys', null, [colTag('services')], async () => {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'services',
      where: { _status: { equals: 'published' } },
      depth: 0,
      pagination: false,
      select: { key: true },
    });
    return result.docs.map((doc) => doc.key);
  });
  return new Set(keys);
}
