import { eq, sql } from '@payloadcms/db-postgres/drizzle';

import { log } from '@/lib/log/logger';

import { cachedRead } from './cache';
import { drizzleTable } from './drizzle';
import { getPayloadClient } from './payload';
import { colTag } from './tags';

export type RedirectStatus = 301 | 302 | 308 | 410;
export type RedirectRow = readonly [from: string, to: string | null, status: RedirectStatus];
export interface RedirectsSnapshot {
  generatedAt: string;
  rows: RedirectRow[];
}

export const REDIRECTS_SNAPSHOT_MAX = 5000;

/** Active redirect rows for the proxy. Over 5000 rows: a warning, and the first 5000 by `from`. */
export function getRedirectsSnapshot(): Promise<RedirectsSnapshot> {
  return cachedRead('getRedirectsSnapshot', null, [colTag('redirects')], async () => {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'redirects',
      where: { active: { equals: true } },
      sort: 'from',
      depth: 0,
      limit: REDIRECTS_SNAPSHOT_MAX + 1,
      pagination: false,
      select: { from: true, to: true, statusCode: true },
    });
    if (result.docs.length > REDIRECTS_SNAPSHOT_MAX) {
      log.warn(
        { max: REDIRECTS_SNAPSHOT_MAX },
        'redirects: more active rows than the snapshot keeps',
      );
    }
    const rows = result.docs
      .slice(0, REDIRECTS_SNAPSHOT_MAX)
      .map((doc): RedirectRow => [
        doc.from,
        doc.to ?? null,
        Number(doc.statusCode) as RedirectStatus,
      ]);
    return { generatedAt: new Date().toISOString(), rows };
  });
}

/**
 * One SQL statement per hit, never `payload.update`: an update would write a version and an
 * audit row per visit (spec-data 2.13 "Hit counting").
 */
export async function recordRedirectHit(from: string): Promise<void> {
  const payload = await getPayloadClient();
  const { db, table } = drizzleTable(payload, 'redirects');
  await db.drizzle
    .update(table)
    .set({ hits: sql`coalesce(${table.hits}, 0) + 1`, lastHitAt: new Date().toISOString() })
    .where(eq(table.from as never, from));
}
