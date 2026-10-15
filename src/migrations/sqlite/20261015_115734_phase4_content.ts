import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`heading\` text,
  	\`intro\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_sections_order_idx\` ON \`pages_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_sections_parent_id_idx\` ON \`pages_sections\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_steps\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_steps_items_order_idx\` ON \`pages_blocks_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_steps_items_parent_id_idx\` ON \`pages_blocks_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_steps_order_idx\` ON \`pages_blocks_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_steps_parent_id_idx\` ON \`pages_blocks_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_steps_path_idx\` ON \`pages_blocks_steps\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`heading\` text,
  	\`intro\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sections_order_idx\` ON \`_pages_v_version_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sections_parent_id_idx\` ON \`_pages_v_version_sections\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_steps\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_steps_items_order_idx\` ON \`_pages_v_blocks_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_steps_items_parent_id_idx\` ON \`_pages_v_blocks_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_steps_order_idx\` ON \`_pages_v_blocks_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_steps_parent_id_idx\` ON \`_pages_v_blocks_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_steps_path_idx\` ON \`_pages_v_blocks_steps\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`service_categories_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`service_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`service_categories_faqs_order_idx\` ON \`service_categories_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_faqs_parent_id_idx\` ON \`service_categories_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_service_categories_v_version_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_service_categories_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_faqs_order_idx\` ON \`_service_categories_v_version_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_faqs_parent_id_idx\` ON \`_service_categories_v_version_faqs\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`service_categories\` ADD \`hero_media_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`service_categories\` ADD \`intro\` text;`)
  await db.run(sql`CREATE INDEX \`service_categories_hero_media_idx\` ON \`service_categories\` (\`hero_media_id\`);`)
  await db.run(sql`ALTER TABLE \`_service_categories_v\` ADD \`version_hero_media_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`_service_categories_v\` ADD \`version_intro\` text;`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_hero_media_idx\` ON \`_service_categories_v\` (\`version_hero_media_id\`);`)
  await db.run(sql`ALTER TABLE \`clinic\` ADD \`footer_line\` text;`)
  await db.run(sql`ALTER TABLE \`_clinic_v\` ADD \`version_footer_line\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_sections\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_steps_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_steps\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_sections\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_steps_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_steps\`;`)
  await db.run(sql`DROP TABLE \`service_categories_faqs\`;`)
  await db.run(sql`DROP TABLE \`_service_categories_v_version_faqs\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_service_categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`h1\` text,
  	\`nav_label\` text,
  	\`standalone\` integer DEFAULT false,
  	\`standalone_service_id\` integer,
  	\`slug\` text,
  	\`accent\` text,
  	\`icon\` text,
  	\`summary\` text,
  	\`order\` numeric DEFAULT 100,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`standalone_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_service_categories\`("id", "key", "title", "h1", "nav_label", "standalone", "standalone_service_id", "slug", "accent", "icon", "summary", "order", "seo_title", "seo_description", "seo_image_id", "seo_noindex", "updated_at", "created_at", "deleted_at", "_status") SELECT "id", "key", "title", "h1", "nav_label", "standalone", "standalone_service_id", "slug", "accent", "icon", "summary", "order", "seo_title", "seo_description", "seo_image_id", "seo_noindex", "updated_at", "created_at", "deleted_at", "_status" FROM \`service_categories\`;`)
  await db.run(sql`DROP TABLE \`service_categories\`;`)
  await db.run(sql`ALTER TABLE \`__new_service_categories\` RENAME TO \`service_categories\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`service_categories_key_idx\` ON \`service_categories\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_standalone_service_idx\` ON \`service_categories\` (\`standalone_service_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`service_categories_slug_idx\` ON \`service_categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_order_idx\` ON \`service_categories\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_seo_seo_image_idx\` ON \`service_categories\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_updated_at_idx\` ON \`service_categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_created_at_idx\` ON \`service_categories\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_deleted_at_idx\` ON \`service_categories\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories__status_idx\` ON \`service_categories\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__service_categories_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_key\` text,
  	\`version_title\` text,
  	\`version_h1\` text,
  	\`version_nav_label\` text,
  	\`version_standalone\` integer DEFAULT false,
  	\`version_standalone_service_id\` integer,
  	\`version_slug\` text,
  	\`version_accent\` text,
  	\`version_icon\` text,
  	\`version_summary\` text,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_seo_title\` text,
  	\`version_seo_description\` text,
  	\`version_seo_image_id\` integer,
  	\`version_seo_noindex\` integer DEFAULT false,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`service_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_standalone_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new__service_categories_v\`("id", "parent_id", "version_key", "version_title", "version_h1", "version_nav_label", "version_standalone", "version_standalone_service_id", "version_slug", "version_accent", "version_icon", "version_summary", "version_order", "version_seo_title", "version_seo_description", "version_seo_image_id", "version_seo_noindex", "version_updated_at", "version_created_at", "version_deleted_at", "version__status", "created_at", "updated_at", "latest") SELECT "id", "parent_id", "version_key", "version_title", "version_h1", "version_nav_label", "version_standalone", "version_standalone_service_id", "version_slug", "version_accent", "version_icon", "version_summary", "version_order", "version_seo_title", "version_seo_description", "version_seo_image_id", "version_seo_noindex", "version_updated_at", "version_created_at", "version_deleted_at", "version__status", "created_at", "updated_at", "latest" FROM \`_service_categories_v\`;`)
  await db.run(sql`DROP TABLE \`_service_categories_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__service_categories_v\` RENAME TO \`_service_categories_v\`;`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_parent_idx\` ON \`_service_categories_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_key_idx\` ON \`_service_categories_v\` (\`version_key\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_standalone_service_idx\` ON \`_service_categories_v\` (\`version_standalone_service_id\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_slug_idx\` ON \`_service_categories_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_order_idx\` ON \`_service_categories_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_seo_version_seo_image_idx\` ON \`_service_categories_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_updated_at_idx\` ON \`_service_categories_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_created_at_idx\` ON \`_service_categories_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version_deleted_at_idx\` ON \`_service_categories_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_version_version__status_idx\` ON \`_service_categories_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_created_at_idx\` ON \`_service_categories_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_updated_at_idx\` ON \`_service_categories_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_categories_v_latest_idx\` ON \`_service_categories_v\` (\`latest\`);`)
  await db.run(sql`ALTER TABLE \`clinic\` DROP COLUMN \`footer_line\`;`)
  await db.run(sql`ALTER TABLE \`_clinic_v\` DROP COLUMN \`version_footer_line\`;`)
}
