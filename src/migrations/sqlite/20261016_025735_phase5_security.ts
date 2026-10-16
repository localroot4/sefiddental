import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`bookings_duplicate_submissions\` ADD \`sid_hash\` text;`)
  await db.run(sql`ALTER TABLE \`bookings\` ADD \`appends_dropped\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`bookings\` ADD \`sid_hash\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`bookings_duplicate_submissions\` DROP COLUMN \`sid_hash\`;`)
  await db.run(sql`ALTER TABLE \`bookings\` DROP COLUMN \`appends_dropped\`;`)
  await db.run(sql`ALTER TABLE \`bookings\` DROP COLUMN \`sid_hash\`;`)
}
