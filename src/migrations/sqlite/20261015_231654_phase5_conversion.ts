import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`bookings_duplicate_submissions_triage\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` text NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`bookings_duplicate_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_duplicate_submissions_triage_order_idx\` ON \`bookings_duplicate_submissions_triage\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`bookings_duplicate_submissions_triage_parent_idx\` ON \`bookings_duplicate_submissions_triage\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`sms_throttle\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`destination_hash\` text NOT NULL,
  	\`last_sent_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`sms_throttle_destination_hash_idx\` ON \`sms_throttle\` (\`destination_hash\`);`)
  await db.run(sql`CREATE INDEX \`sms_throttle_updated_at_idx\` ON \`sms_throttle\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`sms_throttle_created_at_idx\` ON \`sms_throttle\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`bookings_duplicate_submissions\` ADD \`ip_hash\` text;`)
  await db.run(sql`CREATE INDEX \`bookings_duplicate_submissions_ip_hash_idx\` ON \`bookings_duplicate_submissions\` (\`ip_hash\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`bookings_duplicate_submissions_triage\`;`)
  await db.run(sql`DROP TABLE \`sms_throttle\`;`)
  await db.run(sql`DROP INDEX \`bookings_duplicate_submissions_ip_hash_idx\`;`)
  await db.run(sql`ALTER TABLE \`bookings_duplicate_submissions\` DROP COLUMN \`ip_hash\`;`)
}
