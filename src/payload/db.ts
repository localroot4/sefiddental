import { postgresAdapter } from '@payloadcms/db-postgres';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import path from 'node:path';

import { dbKindFromUrl } from '../lib/env';
import { migrations as postgresMigrations } from '../migrations/postgres';
import { migrations as sqliteMigrations } from '../migrations/sqlite';

/**
 * The database adapter follows the DATABASE_URL scheme: postgres:// or postgresql:// selects
 * PostgreSQL (production), file: selects SQLite (tests, local). Both adapters are bundled, so
 * one build serves either database. Each adapter keeps its own migration directory because the
 * SQL dialects differ. DB_PUSH=false turns Drizzle push off for every migrated database.
 */
export function databaseAdapter(srcDir: string) {
  const url = process.env.DATABASE_URL ?? '';
  const push = process.env.DB_PUSH !== 'false';
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
