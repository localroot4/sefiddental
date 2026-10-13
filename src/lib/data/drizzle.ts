import type { Payload } from 'payload';

/**
 * The SQL handle both Payload adapters expose (spec-data P36): `payload.db.drizzle` and the
 * table objects in `payload.db.tables`. Typed loosely because the Postgres and SQLite drizzle
 * builders differ in type only; the calls used here exist on both (P37).
 */
export interface DrizzleHandle {
  drizzle: {
    insert(table: unknown): {
      values(row: Record<string, unknown>): {
        onConflictDoUpdate(config: {
          target: unknown[];
          set: Record<string, unknown>;
        }): Promise<unknown>;
      };
    };
    update(table: unknown): {
      set(values: Record<string, unknown>): { where(condition: unknown): Promise<unknown> };
    };
  };
  tables: Record<string, Record<string, unknown> | undefined>;
}

export function drizzleTable(
  payload: Payload,
  name: string,
): { db: DrizzleHandle; table: Record<string, unknown> } {
  const db = payload.db as unknown as DrizzleHandle;
  const table = db.tables?.[name];
  if (!db.drizzle || !table) {
    throw new Error(
      `drizzleTable: table "${name}" not found in payload.db.tables (SQL adapter required).`,
    );
  }
  return { db, table };
}
