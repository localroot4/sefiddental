// Per-file setup of the Vitest `int` project. It runs before the test file imports
// `@payload-config`, so the database adapter (src/payload/db.ts) reads the values set here.
//
// Default: SQLite, one file per worker in the run's temporary directory, schema by Drizzle push
// (PAYLOAD_FORCE_DRIZZLE_PUSH skips Drizzle's "schema unchanged" cache between databases).
// INT_DATABASE_URL set (CI): that PostgreSQL database, already migrated (`npm run migrate`),
// push off. Tests never assume empty tables: they assert by natural keys or deltas.
import path from 'node:path';

import { inject } from 'vitest';

const dataDir = inject('intDataDir');
const worker = process.env.VITEST_POOL_ID ?? '0';
const postgresUrl = process.env.INT_DATABASE_URL;

if (postgresUrl) {
  if (!/^postgres(ql)?:\/\//.test(postgresUrl)) {
    throw new Error(
      'tests/setup/int.ts: INT_DATABASE_URL must be a postgres:// URL of a migrated database.',
    );
  }
  process.env.DATABASE_URL = postgresUrl;
  process.env.DB_PUSH = 'false';
  delete process.env.PAYLOAD_FORCE_DRIZZLE_PUSH;
} else {
  process.env.DATABASE_URL = `file:${path.join(dataDir, `int-${worker}.db`)}`;
  // A shell or .env value of DB_PUSH=false must not leave the fresh file without tables.
  process.env.DB_PUSH = 'true';
  process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true';
}
process.env.MEDIA_DIR = path.join(dataDir, `media-${worker}`);
// Values from the shell win (CI sets its own per-run secrets).
for (const [name, value] of Object.entries(inject('intSecrets'))) process.env[name] ??= value;
