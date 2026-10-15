import { createHmac } from 'node:crypto';

import { and, eq, lt, type Column } from '@payloadcms/db-postgres/drizzle';
import type { Payload } from 'payload';

import { drizzleTable } from '@/lib/data/drizzle';

/**
 * SMS cap (conversion.md 5.3, admin-notify.md 9.6): at most one message per form-supplied
 * destination per rolling 24 hours, "whatever the form receives". A binding number, so a code
 * constant, never an env value (C-10). Admin recipients are not capped (C-3).
 */
export const SMS_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SMS_THROTTLE_TABLE = 'sms_throttle';

/** HMAC-SHA256 of the E.164 number with IP_HASH_SECRET; changing the secret resets the cap. */
export function destinationHash(e164: string, secret: string): string {
  return createHmac('sha256', secret).update(`sms:${e164}`).digest('hex');
}

// The two calls the shared DrizzleHandle does not type; both exist with this shape on the
// Postgres and SQLite drizzle builders.
interface ThrottleDb {
  drizzle: {
    insert(table: unknown): {
      values(row: Record<string, unknown>): {
        onConflictDoUpdate(config: {
          target: unknown;
          set: Record<string, unknown>;
          setWhere: unknown;
        }): { returning(fields: Record<string, unknown>): Promise<unknown[]> };
      };
    };
    delete(table: unknown): { where(condition: unknown): Promise<unknown> };
  };
}

function throttleTable(payload: Payload) {
  const { db, table } = drizzleTable(payload, SMS_THROTTLE_TABLE);
  return {
    db: db as unknown as ThrottleDb,
    table: table as unknown as { id: Column; destinationHash: Column; lastSentAt: Column },
  };
}

/**
 * Claims the destination for one message in one statement (no race between parallel jobs):
 * insert, or move lastSentAt only when the previous send is older than 24 hours. Returns the
 * claimed time when allowed, null when capped.
 */
export async function claimSms(
  payload: Payload,
  hash: string,
  nowMs: number,
): Promise<string | null> {
  const { db, table } = throttleTable(payload);
  const now = new Date(nowMs).toISOString();
  const cutoff = new Date(nowMs - SMS_CAP_WINDOW_MS).toISOString();
  const rows = await db.drizzle
    .insert(table)
    .values({ destinationHash: hash, lastSentAt: now, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: table.destinationHash,
      set: { lastSentAt: now, updatedAt: now },
      setWhere: lt(table.lastSentAt, cutoff),
    })
    .returning({ id: table.id });
  return rows.length > 0 ? now : null;
}

/** After a failed send: frees the claim if it is still this one, so a retry can claim again. */
export async function releaseSms(payload: Payload, hash: string, claimedAt: string): Promise<void> {
  const { db, table } = throttleTable(payload);
  await db.drizzle
    .delete(table)
    .where(and(eq(table.destinationHash, hash), eq(table.lastSentAt, claimedAt)));
}
