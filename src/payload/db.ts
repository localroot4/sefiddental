import { postgresAdapter } from '@payloadcms/db-postgres';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import type { EventEmitter } from 'node:events';
import path from 'node:path';

import { dbKindFromUrl } from '../lib/env';
import { migrations as postgresMigrations } from '../migrations/postgres';
import { migrations as sqliteMigrations } from '../migrations/sqlite';

/**
 * The database adapter follows the DATABASE_URL scheme: postgres:// or postgresql:// selects
 * PostgreSQL (production), file: selects SQLite (tests, local). Both adapters are bundled, so
 * one build serves either database. Each adapter keeps its own migration directory because the
 * SQL dialects differ. DB_PUSH=false (or 0, off, no) turns Drizzle push off for every migrated
 * database.
 */
export function databaseAdapter(srcDir: string) {
  const url = process.env.DATABASE_URL ?? '';
  // The falsy words of the env flags: DB_PUSH=off must not push a migrated database (SEC-S3).
  const push = !['false', '0', 'off', 'no'].includes(
    (process.env.DB_PUSH ?? '').trim().toLowerCase(),
  );
  if (dbKindFromUrl(url) === 'sqlite') {
    return sqliteAdapter({
      client: { url },
      migrationDir: path.resolve(srcDir, 'migrations/sqlite'),
      prodMigrations: sqliteMigrations,
      push,
      wal: true,
      busyTimeout: 5000,
      // No transactionOptions: SQLite transactions stay off (SQLITE_BUSY with jobs).
    });
  }
  return postgresAdapter({
    pool: { connectionString: url, connectionTimeoutMillis: 5000 },
    migrationDir: path.resolve(srcDir, 'migrations/postgres'),
    prodMigrations: postgresMigrations,
    push,
  });
}

/**
 * pg-pool emits 'error' when the server drops an idle client (restart, failover, idle-session
 * kill). With no listener Node prints the whole client, cancel key included, as a 100-line
 * uncaughtException outside the JSON log (SEC-S5). One warn line with the code instead; the pool
 * replaces the client on the next query.
 */
export function logPoolErrors(db: unknown, warn: (line: Record<string, unknown>) => void): void {
  const pool = (db as { pool?: EventEmitter } | null)?.pool;
  pool?.on('error', (err: Error & { code?: string }) => {
    warn({ msg: 'db_pool_error', code: err.code, reason: err.message });
  });
}
