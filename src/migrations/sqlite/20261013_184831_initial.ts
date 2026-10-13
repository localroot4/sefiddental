import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`bookings_triage\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`bookings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_triage_order_idx\` ON \`bookings_triage\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`bookings_triage_parent_idx\` ON \`bookings_triage\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`bookings_flags\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`bookings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_flags_order_idx\` ON \`bookings_flags\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`bookings_flags_parent_idx\` ON \`bookings_flags\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`bookings_admin_notes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text NOT NULL,
  	\`author_id\` integer,
  	\`at\` text,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`bookings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_admin_notes_order_idx\` ON \`bookings_admin_notes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`bookings_admin_notes_parent_id_idx\` ON \`bookings_admin_notes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`bookings_admin_notes_author_idx\` ON \`bookings_admin_notes\` (\`author_id\`);`)
  await db.run(sql`CREATE TABLE \`bookings_duplicate_submissions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`at\` text,
  	\`name\` text,
  	\`note\` text,
  	\`service_key\` text,
  	\`preferred_time\` text,
  	\`source_url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`bookings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_duplicate_submissions_order_idx\` ON \`bookings_duplicate_submissions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`bookings_duplicate_submissions_parent_id_idx\` ON \`bookings_duplicate_submissions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`bookings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`list_title\` text,
  	\`phone\` text NOT NULL,
  	\`phone_national\` text NOT NULL,
  	\`name\` text,
  	\`kind\` text DEFAULT 'regular' NOT NULL,
  	\`booking_group\` text,
  	\`service_id\` integer,
  	\`service_key\` text,
  	\`tier\` text,
  	\`doctor_id\` integer,
  	\`preferred_time\` text,
  	\`note\` text,
  	\`emergency_outcome\` text,
  	\`status\` text DEFAULT 'new' NOT NULL,
  	\`form_location\` text,
  	\`heard_from\` text,
  	\`callback_due_at\` text,
  	\`urgency_rank\` numeric,
  	\`handled_by_id\` integer,
  	\`handled_at\` text,
  	\`source_url\` text,
  	\`utm_source\` text,
  	\`utm_medium\` text,
  	\`utm_campaign\` text,
  	\`utm_term\` text,
  	\`utm_content\` text,
  	\`device\` text,
  	\`ip_hash\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`handled_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`bookings_phone_idx\` ON \`bookings\` (\`phone\`);`)
  await db.run(sql`CREATE INDEX \`bookings_phone_national_idx\` ON \`bookings\` (\`phone_national\`);`)
  await db.run(sql`CREATE INDEX \`bookings_kind_idx\` ON \`bookings\` (\`kind\`);`)
  await db.run(sql`CREATE INDEX \`bookings_booking_group_idx\` ON \`bookings\` (\`booking_group\`);`)
  await db.run(sql`CREATE INDEX \`bookings_service_idx\` ON \`bookings\` (\`service_id\`);`)
  await db.run(sql`CREATE INDEX \`bookings_doctor_idx\` ON \`bookings\` (\`doctor_id\`);`)
  await db.run(sql`CREATE INDEX \`bookings_emergency_outcome_idx\` ON \`bookings\` (\`emergency_outcome\`);`)
  await db.run(sql`CREATE INDEX \`bookings_status_idx\` ON \`bookings\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`bookings_heard_from_idx\` ON \`bookings\` (\`heard_from\`);`)
  await db.run(sql`CREATE INDEX \`bookings_callback_due_at_idx\` ON \`bookings\` (\`callback_due_at\`);`)
  await db.run(sql`CREATE INDEX \`bookings_urgency_rank_idx\` ON \`bookings\` (\`urgency_rank\`);`)
  await db.run(sql`CREATE INDEX \`bookings_handled_by_idx\` ON \`bookings\` (\`handled_by_id\`);`)
  await db.run(sql`CREATE INDEX \`bookings_ip_hash_idx\` ON \`bookings\` (\`ip_hash\`);`)
  await db.run(sql`CREATE INDEX \`bookings_updated_at_idx\` ON \`bookings\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`bookings_created_at_idx\` ON \`bookings\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`bookings_deleted_at_idx\` ON \`bookings\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`phone_createdAt_idx\` ON \`bookings\` (\`phone\`,\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`ipHash_createdAt_idx\` ON \`bookings\` (\`ip_hash\`,\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`status_createdAt_idx\` ON \`bookings\` (\`status\`,\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_order_idx\` ON \`pages_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_parent_id_idx\` ON \`pages_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_path_idx\` ON \`pages_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_order_idx\` ON \`pages_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_parent_id_idx\` ON \`pages_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_order_idx\` ON \`pages_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_parent_id_idx\` ON \`pages_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_path_idx\` ON \`pages_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_facts_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_facts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_facts_items_order_idx\` ON \`pages_blocks_facts_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_facts_items_parent_id_idx\` ON \`pages_blocks_facts_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_facts\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_facts_order_idx\` ON \`pages_blocks_facts\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_facts_parent_id_idx\` ON \`pages_blocks_facts\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_facts_path_idx\` ON \`pages_blocks_facts\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_callout\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tone\` text DEFAULT 'info',
  	\`text\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_callout_order_idx\` ON \`pages_blocks_callout\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_callout_parent_id_idx\` ON \`pages_blocks_callout\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_callout_path_idx\` ON \`pages_blocks_callout\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_sources_order_idx\` ON \`pages_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_sources_parent_id_idx\` ON \`pages_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`slug\` text,
  	\`path\` text,
  	\`lead\` text,
  	\`hero_photo_id\` integer,
  	\`hero_photo_portrait_id\` integer,
  	\`hero_subtext\` text,
  	\`hero_media_id\` integer,
  	\`reviewer_id\` integer,
  	\`reviewed_at\` text,
  	\`reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_photo_portrait_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewer_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_key_idx\` ON \`pages\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_path_idx\` ON \`pages\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`pages_hero_hero_photo_idx\` ON \`pages\` (\`hero_photo_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_hero_hero_photo_portrait_idx\` ON \`pages\` (\`hero_photo_portrait_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_hero_media_idx\` ON \`pages\` (\`hero_media_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_reviewer_idx\` ON \`pages\` (\`reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_seo_seo_image_idx\` ON \`pages\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`pages__status_idx\` ON \`pages\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_order_idx\` ON \`_pages_v_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_parent_id_idx\` ON \`_pages_v_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_path_idx\` ON \`_pages_v_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_items_order_idx\` ON \`_pages_v_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_items_parent_id_idx\` ON \`_pages_v_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_order_idx\` ON \`_pages_v_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_parent_id_idx\` ON \`_pages_v_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_path_idx\` ON \`_pages_v_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_facts_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_facts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_facts_items_order_idx\` ON \`_pages_v_blocks_facts_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_facts_items_parent_id_idx\` ON \`_pages_v_blocks_facts_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_facts\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_facts_order_idx\` ON \`_pages_v_blocks_facts\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_facts_parent_id_idx\` ON \`_pages_v_blocks_facts\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_facts_path_idx\` ON \`_pages_v_blocks_facts\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_callout\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tone\` text DEFAULT 'info',
  	\`text\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_callout_order_idx\` ON \`_pages_v_blocks_callout\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_callout_parent_id_idx\` ON \`_pages_v_blocks_callout\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_callout_path_idx\` ON \`_pages_v_blocks_callout\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sources_order_idx\` ON \`_pages_v_version_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_sources_parent_id_idx\` ON \`_pages_v_version_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_key\` text,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_path\` text,
  	\`version_lead\` text,
  	\`version_hero_photo_id\` integer,
  	\`version_hero_photo_portrait_id\` integer,
  	\`version_hero_subtext\` text,
  	\`version_hero_media_id\` integer,
  	\`version_reviewer_id\` integer,
  	\`version_reviewed_at\` text,
  	\`version_reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`version_seo_title\` text,
  	\`version_seo_description\` text,
  	\`version_seo_image_id\` integer,
  	\`version_seo_noindex\` integer DEFAULT false,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_photo_portrait_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_reviewer_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_key_idx\` ON \`_pages_v\` (\`version_key\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_slug_idx\` ON \`_pages_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_path_idx\` ON \`_pages_v\` (\`version_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_hero_version_hero_photo_idx\` ON \`_pages_v\` (\`version_hero_photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_hero_version_hero_photo_portrait_idx\` ON \`_pages_v\` (\`version_hero_photo_portrait_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_hero_media_idx\` ON \`_pages_v\` (\`version_hero_media_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_reviewer_idx\` ON \`_pages_v\` (\`version_reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_seo_version_seo_image_idx\` ON \`_pages_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_updated_at_idx\` ON \`_pages_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_created_at_idx\` ON \`_pages_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version__status_idx\` ON \`_pages_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_autosave_idx\` ON \`_pages_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`service_categories\` (
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
  await db.run(sql`CREATE UNIQUE INDEX \`service_categories_key_idx\` ON \`service_categories\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_standalone_service_idx\` ON \`service_categories\` (\`standalone_service_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`service_categories_slug_idx\` ON \`service_categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_order_idx\` ON \`service_categories\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_seo_seo_image_idx\` ON \`service_categories\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_updated_at_idx\` ON \`service_categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_created_at_idx\` ON \`service_categories\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories_deleted_at_idx\` ON \`service_categories\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`service_categories__status_idx\` ON \`service_categories\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_service_categories_v\` (
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
  await db.run(sql`CREATE TABLE \`services_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_blocks_content_order_idx\` ON \`services_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_content_parent_id_idx\` ON \`services_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_content_path_idx\` ON \`services_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`services_blocks_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services_blocks_steps\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_blocks_steps_items_order_idx\` ON \`services_blocks_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_steps_items_parent_id_idx\` ON \`services_blocks_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_blocks_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_blocks_steps_order_idx\` ON \`services_blocks_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_steps_parent_id_idx\` ON \`services_blocks_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_steps_path_idx\` ON \`services_blocks_steps\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`services_blocks_callout\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tone\` text DEFAULT 'info',
  	\`text\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_blocks_callout_order_idx\` ON \`services_blocks_callout\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_callout_parent_id_idx\` ON \`services_blocks_callout\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`services_blocks_callout_path_idx\` ON \`services_blocks_callout\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`services_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_faqs_order_idx\` ON \`services_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_faqs_parent_id_idx\` ON \`services_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_sources_order_idx\` ON \`services_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_sources_parent_id_idx\` ON \`services_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`category_id\` integer,
  	\`nav_label\` text,
  	\`h1\` text,
  	\`slug\` text,
  	\`booking_group\` text,
  	\`priority\` numeric,
  	\`order\` numeric DEFAULT 100,
  	\`emergency_link\` integer DEFAULT false,
  	\`summary\` text,
  	\`hero_media_id\` integer,
  	\`facts_sessions\` text,
  	\`facts_duration\` text,
  	\`facts_anesthesia\` text,
  	\`facts_recovery\` text,
  	\`price_from\` numeric,
  	\`reviewed_by_id\` integer,
  	\`reviewed_at\` text,
  	\`reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`is_medical\` integer DEFAULT true,
  	\`internal_note\` text,
  	\`scope_verified\` integer DEFAULT true,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`category_id\`) REFERENCES \`service_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewed_by_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`services_key_idx\` ON \`services\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`services_category_idx\` ON \`services\` (\`category_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`services_slug_idx\` ON \`services\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`services_booking_group_idx\` ON \`services\` (\`booking_group\`);`)
  await db.run(sql`CREATE INDEX \`services_priority_idx\` ON \`services\` (\`priority\`);`)
  await db.run(sql`CREATE INDEX \`services_order_idx\` ON \`services\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`services_hero_media_idx\` ON \`services\` (\`hero_media_id\`);`)
  await db.run(sql`CREATE INDEX \`services_reviewed_by_idx\` ON \`services\` (\`reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`services_seo_seo_image_idx\` ON \`services\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`services_updated_at_idx\` ON \`services\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`services_created_at_idx\` ON \`services\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`services_deleted_at_idx\` ON \`services\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`services__status_idx\` ON \`services\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`services_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_texts_order_parent\` ON \`services_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`services_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_rels_order_idx\` ON \`services_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`services_rels_parent_idx\` ON \`services_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`services_rels_path_idx\` ON \`services_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`services_rels_services_id_idx\` ON \`services_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_content_order_idx\` ON \`_services_v_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_content_parent_id_idx\` ON \`_services_v_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_content_path_idx\` ON \`_services_v_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_blocks_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v_blocks_steps\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_steps_items_order_idx\` ON \`_services_v_blocks_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_steps_items_parent_id_idx\` ON \`_services_v_blocks_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_blocks_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_steps_order_idx\` ON \`_services_v_blocks_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_steps_parent_id_idx\` ON \`_services_v_blocks_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_steps_path_idx\` ON \`_services_v_blocks_steps\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_blocks_callout\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tone\` text DEFAULT 'info',
  	\`text\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_callout_order_idx\` ON \`_services_v_blocks_callout\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_callout_parent_id_idx\` ON \`_services_v_blocks_callout\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_blocks_callout_path_idx\` ON \`_services_v_blocks_callout\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_version_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_version_faqs_order_idx\` ON \`_services_v_version_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_faqs_parent_id_idx\` ON \`_services_v_version_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_version_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_version_sources_order_idx\` ON \`_services_v_version_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_sources_parent_id_idx\` ON \`_services_v_version_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_services_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_key\` text,
  	\`version_category_id\` integer,
  	\`version_nav_label\` text,
  	\`version_h1\` text,
  	\`version_slug\` text,
  	\`version_booking_group\` text,
  	\`version_priority\` numeric,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_emergency_link\` integer DEFAULT false,
  	\`version_summary\` text,
  	\`version_hero_media_id\` integer,
  	\`version_facts_sessions\` text,
  	\`version_facts_duration\` text,
  	\`version_facts_anesthesia\` text,
  	\`version_facts_recovery\` text,
  	\`version_price_from\` numeric,
  	\`version_reviewed_by_id\` integer,
  	\`version_reviewed_at\` text,
  	\`version_reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`version_is_medical\` integer DEFAULT true,
  	\`version_internal_note\` text,
  	\`version_scope_verified\` integer DEFAULT true,
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
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`service_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_reviewed_by_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_parent_idx\` ON \`_services_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_key_idx\` ON \`_services_v\` (\`version_key\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_category_idx\` ON \`_services_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_slug_idx\` ON \`_services_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_booking_group_idx\` ON \`_services_v\` (\`version_booking_group\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_priority_idx\` ON \`_services_v\` (\`version_priority\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_order_idx\` ON \`_services_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_hero_media_idx\` ON \`_services_v\` (\`version_hero_media_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_reviewed_by_idx\` ON \`_services_v\` (\`version_reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_seo_version_seo_image_idx\` ON \`_services_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_updated_at_idx\` ON \`_services_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_created_at_idx\` ON \`_services_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version_deleted_at_idx\` ON \`_services_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_version_version__status_idx\` ON \`_services_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_created_at_idx\` ON \`_services_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_updated_at_idx\` ON \`_services_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_latest_idx\` ON \`_services_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_texts_order_parent\` ON \`_services_v_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_services_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`services_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_services_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_services_v_rels_order_idx\` ON \`_services_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_rels_parent_idx\` ON \`_services_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_rels_path_idx\` ON \`_services_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_services_v_rels_services_id_idx\` ON \`_services_v_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE TABLE \`service_tiers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`service_id\` integer,
  	\`key\` text,
  	\`name\` text,
  	\`description\` text,
  	\`materials\` text,
  	\`price_from\` numeric,
  	\`order\` numeric DEFAULT 100,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`service_tiers_service_idx\` ON \`service_tiers\` (\`service_id\`);`)
  await db.run(sql`CREATE INDEX \`service_tiers_order_idx\` ON \`service_tiers\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`service_tiers_updated_at_idx\` ON \`service_tiers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`service_tiers_created_at_idx\` ON \`service_tiers\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`service_tiers_deleted_at_idx\` ON \`service_tiers\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`service_tiers__status_idx\` ON \`service_tiers\` (\`_status\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`service_key_idx\` ON \`service_tiers\` (\`service_id\`,\`key\`);`)
  await db.run(sql`CREATE TABLE \`service_tiers_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`service_tiers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`service_tiers_texts_order_parent\` ON \`service_tiers_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_service_tiers_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_service_id\` integer,
  	\`version_key\` text,
  	\`version_name\` text,
  	\`version_description\` text,
  	\`version_materials\` text,
  	\`version_price_from\` numeric,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`service_tiers\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_parent_idx\` ON \`_service_tiers_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version_service_idx\` ON \`_service_tiers_v\` (\`version_service_id\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version_order_idx\` ON \`_service_tiers_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version_updated_at_idx\` ON \`_service_tiers_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version_created_at_idx\` ON \`_service_tiers_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version_deleted_at_idx\` ON \`_service_tiers_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_version_version__status_idx\` ON \`_service_tiers_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_created_at_idx\` ON \`_service_tiers_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_updated_at_idx\` ON \`_service_tiers_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_latest_idx\` ON \`_service_tiers_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`version_service_version_key_idx\` ON \`_service_tiers_v\` (\`version_service_id\`,\`version_key\`);`)
  await db.run(sql`CREATE TABLE \`_service_tiers_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_service_tiers_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_service_tiers_v_texts_order_parent\` ON \`_service_tiers_v_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`doctors\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`slug\` text,
  	\`specialty\` text,
  	\`specialty_confirmed\` integer DEFAULT false,
  	\`council_number\` text,
  	\`years_experience\` numeric,
  	\`bio\` text,
  	\`photo_id\` integer,
  	\`order\` numeric DEFAULT 100,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`doctors_slug_idx\` ON \`doctors\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`doctors_council_number_idx\` ON \`doctors\` (\`council_number\`);`)
  await db.run(sql`CREATE INDEX \`doctors_photo_idx\` ON \`doctors\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`doctors_order_idx\` ON \`doctors\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`doctors_seo_seo_image_idx\` ON \`doctors\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`doctors_updated_at_idx\` ON \`doctors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`doctors_created_at_idx\` ON \`doctors\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`doctors_deleted_at_idx\` ON \`doctors\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`doctors__status_idx\` ON \`doctors\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`doctors_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`doctors_texts_order_parent\` ON \`doctors_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`doctors_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`services_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`doctors_rels_order_idx\` ON \`doctors_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`doctors_rels_parent_idx\` ON \`doctors_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`doctors_rels_path_idx\` ON \`doctors_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`doctors_rels_services_id_idx\` ON \`doctors_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE TABLE \`_doctors_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_name\` text,
  	\`version_slug\` text,
  	\`version_specialty\` text,
  	\`version_specialty_confirmed\` integer DEFAULT false,
  	\`version_council_number\` text,
  	\`version_years_experience\` numeric,
  	\`version_bio\` text,
  	\`version_photo_id\` integer,
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
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_doctors_v_parent_idx\` ON \`_doctors_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_slug_idx\` ON \`_doctors_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_council_number_idx\` ON \`_doctors_v\` (\`version_council_number\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_photo_idx\` ON \`_doctors_v\` (\`version_photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_order_idx\` ON \`_doctors_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_seo_version_seo_image_idx\` ON \`_doctors_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_updated_at_idx\` ON \`_doctors_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_created_at_idx\` ON \`_doctors_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version_deleted_at_idx\` ON \`_doctors_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_version_version__status_idx\` ON \`_doctors_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_created_at_idx\` ON \`_doctors_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_updated_at_idx\` ON \`_doctors_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_latest_idx\` ON \`_doctors_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_doctors_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_doctors_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_doctors_v_texts_order_parent\` ON \`_doctors_v_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_doctors_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`services_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_doctors_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_doctors_v_rels_order_idx\` ON \`_doctors_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_rels_parent_idx\` ON \`_doctors_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_rels_path_idx\` ON \`_doctors_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_doctors_v_rels_services_id_idx\` ON \`_doctors_v_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE TABLE \`articles_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`articles_sources_order_idx\` ON \`articles_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`articles_sources_parent_id_idx\` ON \`articles_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`articles_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`articles_faqs_order_idx\` ON \`articles_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`articles_faqs_parent_id_idx\` ON \`articles_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`articles\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`excerpt\` text,
  	\`cover_id\` integer,
  	\`body\` text,
  	\`category_id\` integer,
  	\`primary_service_id\` integer,
  	\`author_doctor_id\` integer,
  	\`staff_author_name\` text,
  	\`is_medical\` integer DEFAULT true,
  	\`reviewer_id\` integer,
  	\`reviewed_at\` text,
  	\`reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`reading_time\` numeric,
  	\`published_at\` text,
  	\`content_updated_at\` text,
  	\`review_state\` text DEFAULT 'writing',
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`article_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`primary_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`author_doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewer_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`articles_slug_idx\` ON \`articles\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`articles_cover_idx\` ON \`articles\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_category_idx\` ON \`articles\` (\`category_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_primary_service_idx\` ON \`articles\` (\`primary_service_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_author_doctor_idx\` ON \`articles\` (\`author_doctor_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_reviewer_idx\` ON \`articles\` (\`reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_published_at_idx\` ON \`articles\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`articles_review_state_idx\` ON \`articles\` (\`review_state\`);`)
  await db.run(sql`CREATE INDEX \`articles_seo_seo_image_idx\` ON \`articles\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_updated_at_idx\` ON \`articles\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`articles_created_at_idx\` ON \`articles\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`articles_deleted_at_idx\` ON \`articles\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`articles__status_idx\` ON \`articles\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`articles_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`tags_id\` integer,
  	\`articles_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`articles_rels_order_idx\` ON \`articles_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_parent_idx\` ON \`articles_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_path_idx\` ON \`articles_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_tags_id_idx\` ON \`articles_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_articles_id_idx\` ON \`articles_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v_version_sources\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`publisher\` text,
  	\`url\` text,
  	\`accessed_on\` text,
  	\`accessedon_tz\` text DEFAULT 'Asia/Tehran',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_version_sources_order_idx\` ON \`_articles_v_version_sources\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_sources_parent_id_idx\` ON \`_articles_v_version_sources\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v_version_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_version_faqs_order_idx\` ON \`_articles_v_version_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_faqs_parent_id_idx\` ON \`_articles_v_version_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_excerpt\` text,
  	\`version_cover_id\` integer,
  	\`version_body\` text,
  	\`version_category_id\` integer,
  	\`version_primary_service_id\` integer,
  	\`version_author_doctor_id\` integer,
  	\`version_staff_author_name\` text,
  	\`version_is_medical\` integer DEFAULT true,
  	\`version_reviewer_id\` integer,
  	\`version_reviewed_at\` text,
  	\`version_reviewedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`version_reading_time\` numeric,
  	\`version_published_at\` text,
  	\`version_content_updated_at\` text,
  	\`version_review_state\` text DEFAULT 'writing',
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
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`article_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_primary_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_author_doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_reviewer_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_parent_idx\` ON \`_articles_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_slug_idx\` ON \`_articles_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_cover_idx\` ON \`_articles_v\` (\`version_cover_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_category_idx\` ON \`_articles_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_primary_service_idx\` ON \`_articles_v\` (\`version_primary_service_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_author_doctor_idx\` ON \`_articles_v\` (\`version_author_doctor_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_reviewer_idx\` ON \`_articles_v\` (\`version_reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_published_at_idx\` ON \`_articles_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_review_state_idx\` ON \`_articles_v\` (\`version_review_state\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_seo_version_seo_image_idx\` ON \`_articles_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_updated_at_idx\` ON \`_articles_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_created_at_idx\` ON \`_articles_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_deleted_at_idx\` ON \`_articles_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version__status_idx\` ON \`_articles_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_created_at_idx\` ON \`_articles_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_updated_at_idx\` ON \`_articles_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_latest_idx\` ON \`_articles_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_autosave_idx\` ON \`_articles_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`tags_id\` integer,
  	\`articles_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_order_idx\` ON \`_articles_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_parent_idx\` ON \`_articles_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_path_idx\` ON \`_articles_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_tags_id_idx\` ON \`_articles_v_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_articles_id_idx\` ON \`_articles_v_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE TABLE \`article_categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`description\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`article_categories_slug_idx\` ON \`article_categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`article_categories_seo_seo_image_idx\` ON \`article_categories\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`article_categories_updated_at_idx\` ON \`article_categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`article_categories_created_at_idx\` ON \`article_categories\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`article_categories_deleted_at_idx\` ON \`article_categories\` (\`deleted_at\`);`)
  await db.run(sql`CREATE TABLE \`_article_categories_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text NOT NULL,
  	\`version_slug\` text NOT NULL,
  	\`version_description\` text,
  	\`version_seo_title\` text,
  	\`version_seo_description\` text,
  	\`version_seo_image_id\` integer,
  	\`version_seo_noindex\` integer DEFAULT false,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`article_categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_article_categories_v_parent_idx\` ON \`_article_categories_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_version_version_slug_idx\` ON \`_article_categories_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_version_seo_version_seo_image_idx\` ON \`_article_categories_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_version_version_updated_at_idx\` ON \`_article_categories_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_version_version_created_at_idx\` ON \`_article_categories_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_version_version_deleted_at_idx\` ON \`_article_categories_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_created_at_idx\` ON \`_article_categories_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_article_categories_v_updated_at_idx\` ON \`_article_categories_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`tags\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`description\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_noindex\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`tags_slug_idx\` ON \`tags\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`tags_seo_seo_image_idx\` ON \`tags\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`tags_updated_at_idx\` ON \`tags\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tags_created_at_idx\` ON \`tags\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`tags_deleted_at_idx\` ON \`tags\` (\`deleted_at\`);`)
  await db.run(sql`CREATE TABLE \`_tags_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text NOT NULL,
  	\`version_slug\` text NOT NULL,
  	\`version_description\` text,
  	\`version_seo_title\` text,
  	\`version_seo_description\` text,
  	\`version_seo_image_id\` integer,
  	\`version_seo_noindex\` integer DEFAULT false,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_tags_v_parent_idx\` ON \`_tags_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_slug_idx\` ON \`_tags_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_seo_version_seo_image_idx\` ON \`_tags_v\` (\`version_seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_updated_at_idx\` ON \`_tags_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_created_at_idx\` ON \`_tags_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_deleted_at_idx\` ON \`_tags_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_created_at_idx\` ON \`_tags_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_updated_at_idx\` ON \`_tags_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`insurances\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`logo_id\` integer,
  	\`featured\` integer DEFAULT false,
  	\`order\` numeric DEFAULT 100,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`insurances_name_idx\` ON \`insurances\` (\`name\`);`)
  await db.run(sql`CREATE INDEX \`insurances_logo_idx\` ON \`insurances\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`insurances_order_idx\` ON \`insurances\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`insurances_updated_at_idx\` ON \`insurances\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`insurances_created_at_idx\` ON \`insurances\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`insurances_deleted_at_idx\` ON \`insurances\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`insurances__status_idx\` ON \`insurances\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_insurances_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_name\` text,
  	\`version_logo_id\` integer,
  	\`version_featured\` integer DEFAULT false,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`insurances\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_insurances_v_parent_idx\` ON \`_insurances_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_name_idx\` ON \`_insurances_v\` (\`version_name\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_logo_idx\` ON \`_insurances_v\` (\`version_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_order_idx\` ON \`_insurances_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_updated_at_idx\` ON \`_insurances_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_created_at_idx\` ON \`_insurances_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version_deleted_at_idx\` ON \`_insurances_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_version_version__status_idx\` ON \`_insurances_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_created_at_idx\` ON \`_insurances_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_updated_at_idx\` ON \`_insurances_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_insurances_v_latest_idx\` ON \`_insurances_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`financing_options\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`title\` text,
  	\`provider\` text,
  	\`max_amount_toman\` numeric,
  	\`who_applies\` text,
  	\`surcharge_note\` text,
  	\`terms\` text,
  	\`approval_status\` text DEFAULT 'pending',
  	\`approved_on\` text,
  	\`approvedon_tz\` text DEFAULT 'Asia/Tehran',
  	\`enabled\` integer DEFAULT false,
  	\`order\` numeric DEFAULT 100,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`financing_options_key_idx\` ON \`financing_options\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`financing_options_enabled_idx\` ON \`financing_options\` (\`enabled\`);`)
  await db.run(sql`CREATE INDEX \`financing_options_order_idx\` ON \`financing_options\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`financing_options_updated_at_idx\` ON \`financing_options\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`financing_options_created_at_idx\` ON \`financing_options\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`financing_options_deleted_at_idx\` ON \`financing_options\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`financing_options__status_idx\` ON \`financing_options\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_financing_options_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_key\` text,
  	\`version_title\` text,
  	\`version_provider\` text,
  	\`version_max_amount_toman\` numeric,
  	\`version_who_applies\` text,
  	\`version_surcharge_note\` text,
  	\`version_terms\` text,
  	\`version_approval_status\` text DEFAULT 'pending',
  	\`version_approved_on\` text,
  	\`version_approvedon_tz\` text DEFAULT 'Asia/Tehran',
  	\`version_enabled\` integer DEFAULT false,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`financing_options\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_financing_options_v_parent_idx\` ON \`_financing_options_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_key_idx\` ON \`_financing_options_v\` (\`version_key\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_enabled_idx\` ON \`_financing_options_v\` (\`version_enabled\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_order_idx\` ON \`_financing_options_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_updated_at_idx\` ON \`_financing_options_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_created_at_idx\` ON \`_financing_options_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version_deleted_at_idx\` ON \`_financing_options_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_version_version__status_idx\` ON \`_financing_options_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_created_at_idx\` ON \`_financing_options_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_updated_at_idx\` ON \`_financing_options_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_financing_options_v_latest_idx\` ON \`_financing_options_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`caption\` text,
  	\`credit\` text,
  	\`blur_data_u_r_l\` text,
  	\`blur_data_u_r_l_portrait\` text,
  	\`seed_source\` text,
  	\`prefix\` text DEFAULT '',
  	\`_objectkey\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`sizes_thumb_url\` text,
  	\`sizes_thumb_width\` numeric,
  	\`sizes_thumb_height\` numeric,
  	\`sizes_thumb_mime_type\` text,
  	\`sizes_thumb_filesize\` numeric,
  	\`sizes_thumb_filename\` text,
  	\`sizes_w640_url\` text,
  	\`sizes_w640_width\` numeric,
  	\`sizes_w640_height\` numeric,
  	\`sizes_w640_mime_type\` text,
  	\`sizes_w640_filesize\` numeric,
  	\`sizes_w640_filename\` text,
  	\`sizes_w640_avif_url\` text,
  	\`sizes_w640_avif_width\` numeric,
  	\`sizes_w640_avif_height\` numeric,
  	\`sizes_w640_avif_mime_type\` text,
  	\`sizes_w640_avif_filesize\` numeric,
  	\`sizes_w640_avif_filename\` text,
  	\`sizes_w960_url\` text,
  	\`sizes_w960_width\` numeric,
  	\`sizes_w960_height\` numeric,
  	\`sizes_w960_mime_type\` text,
  	\`sizes_w960_filesize\` numeric,
  	\`sizes_w960_filename\` text,
  	\`sizes_w960_avif_url\` text,
  	\`sizes_w960_avif_width\` numeric,
  	\`sizes_w960_avif_height\` numeric,
  	\`sizes_w960_avif_mime_type\` text,
  	\`sizes_w960_avif_filesize\` numeric,
  	\`sizes_w960_avif_filename\` text,
  	\`sizes_w1280_url\` text,
  	\`sizes_w1280_width\` numeric,
  	\`sizes_w1280_height\` numeric,
  	\`sizes_w1280_mime_type\` text,
  	\`sizes_w1280_filesize\` numeric,
  	\`sizes_w1280_filename\` text,
  	\`sizes_w1280_avif_url\` text,
  	\`sizes_w1280_avif_width\` numeric,
  	\`sizes_w1280_avif_height\` numeric,
  	\`sizes_w1280_avif_mime_type\` text,
  	\`sizes_w1280_avif_filesize\` numeric,
  	\`sizes_w1280_avif_filename\` text,
  	\`sizes_w1600_url\` text,
  	\`sizes_w1600_width\` numeric,
  	\`sizes_w1600_height\` numeric,
  	\`sizes_w1600_mime_type\` text,
  	\`sizes_w1600_filesize\` numeric,
  	\`sizes_w1600_filename\` text,
  	\`sizes_w1600_avif_url\` text,
  	\`sizes_w1600_avif_width\` numeric,
  	\`sizes_w1600_avif_height\` numeric,
  	\`sizes_w1600_avif_mime_type\` text,
  	\`sizes_w1600_avif_filesize\` numeric,
  	\`sizes_w1600_avif_filename\` text,
  	\`sizes_w1920_url\` text,
  	\`sizes_w1920_width\` numeric,
  	\`sizes_w1920_height\` numeric,
  	\`sizes_w1920_mime_type\` text,
  	\`sizes_w1920_filesize\` numeric,
  	\`sizes_w1920_filename\` text,
  	\`sizes_w1920_avif_url\` text,
  	\`sizes_w1920_avif_width\` numeric,
  	\`sizes_w1920_avif_height\` numeric,
  	\`sizes_w1920_avif_mime_type\` text,
  	\`sizes_w1920_avif_filesize\` numeric,
  	\`sizes_w1920_avif_filename\` text,
  	\`sizes_w2560_url\` text,
  	\`sizes_w2560_width\` numeric,
  	\`sizes_w2560_height\` numeric,
  	\`sizes_w2560_mime_type\` text,
  	\`sizes_w2560_filesize\` numeric,
  	\`sizes_w2560_filename\` text,
  	\`sizes_w2560_avif_url\` text,
  	\`sizes_w2560_avif_width\` numeric,
  	\`sizes_w2560_avif_height\` numeric,
  	\`sizes_w2560_avif_mime_type\` text,
  	\`sizes_w2560_avif_filesize\` numeric,
  	\`sizes_w2560_avif_filename\` text,
  	\`sizes_p640_url\` text,
  	\`sizes_p640_width\` numeric,
  	\`sizes_p640_height\` numeric,
  	\`sizes_p640_mime_type\` text,
  	\`sizes_p640_filesize\` numeric,
  	\`sizes_p640_filename\` text,
  	\`sizes_p640_avif_url\` text,
  	\`sizes_p640_avif_width\` numeric,
  	\`sizes_p640_avif_height\` numeric,
  	\`sizes_p640_avif_mime_type\` text,
  	\`sizes_p640_avif_filesize\` numeric,
  	\`sizes_p640_avif_filename\` text,
  	\`sizes_p828_url\` text,
  	\`sizes_p828_width\` numeric,
  	\`sizes_p828_height\` numeric,
  	\`sizes_p828_mime_type\` text,
  	\`sizes_p828_filesize\` numeric,
  	\`sizes_p828_filename\` text,
  	\`sizes_p828_avif_url\` text,
  	\`sizes_p828_avif_width\` numeric,
  	\`sizes_p828_avif_height\` numeric,
  	\`sizes_p828_avif_mime_type\` text,
  	\`sizes_p828_avif_filesize\` numeric,
  	\`sizes_p828_avif_filename\` text,
  	\`sizes_p1080_url\` text,
  	\`sizes_p1080_width\` numeric,
  	\`sizes_p1080_height\` numeric,
  	\`sizes_p1080_mime_type\` text,
  	\`sizes_p1080_filesize\` numeric,
  	\`sizes_p1080_filename\` text,
  	\`sizes_p1080_avif_url\` text,
  	\`sizes_p1080_avif_width\` numeric,
  	\`sizes_p1080_avif_height\` numeric,
  	\`sizes_p1080_avif_mime_type\` text,
  	\`sizes_p1080_avif_filesize\` numeric,
  	\`sizes_p1080_avif_filename\` text,
  	\`sizes_s640_url\` text,
  	\`sizes_s640_width\` numeric,
  	\`sizes_s640_height\` numeric,
  	\`sizes_s640_mime_type\` text,
  	\`sizes_s640_filesize\` numeric,
  	\`sizes_s640_filename\` text,
  	\`sizes_s640_avif_url\` text,
  	\`sizes_s640_avif_width\` numeric,
  	\`sizes_s640_avif_height\` numeric,
  	\`sizes_s640_avif_mime_type\` text,
  	\`sizes_s640_avif_filesize\` numeric,
  	\`sizes_s640_avif_filename\` text,
  	\`sizes_s1080_url\` text,
  	\`sizes_s1080_width\` numeric,
  	\`sizes_s1080_height\` numeric,
  	\`sizes_s1080_mime_type\` text,
  	\`sizes_s1080_filesize\` numeric,
  	\`sizes_s1080_filename\` text,
  	\`sizes_s1080_avif_url\` text,
  	\`sizes_s1080_avif_width\` numeric,
  	\`sizes_s1080_avif_height\` numeric,
  	\`sizes_s1080_avif_mime_type\` text,
  	\`sizes_s1080_avif_filesize\` numeric,
  	\`sizes_s1080_avif_filename\` text
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`media_seed_source_idx\` ON \`media\` (\`seed_source\`);`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`media_deleted_at_idx\` ON \`media\` (\`deleted_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_thumb_sizes_thumb_filename_idx\` ON \`media\` (\`sizes_thumb_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w640_sizes_w640_filename_idx\` ON \`media\` (\`sizes_w640_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w640_avif_sizes_w640_avif_filename_idx\` ON \`media\` (\`sizes_w640_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w960_sizes_w960_filename_idx\` ON \`media\` (\`sizes_w960_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w960_avif_sizes_w960_avif_filename_idx\` ON \`media\` (\`sizes_w960_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1280_sizes_w1280_filename_idx\` ON \`media\` (\`sizes_w1280_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1280_avif_sizes_w1280_avif_filename_idx\` ON \`media\` (\`sizes_w1280_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1600_sizes_w1600_filename_idx\` ON \`media\` (\`sizes_w1600_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1600_avif_sizes_w1600_avif_filename_idx\` ON \`media\` (\`sizes_w1600_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1920_sizes_w1920_filename_idx\` ON \`media\` (\`sizes_w1920_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w1920_avif_sizes_w1920_avif_filename_idx\` ON \`media\` (\`sizes_w1920_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w2560_sizes_w2560_filename_idx\` ON \`media\` (\`sizes_w2560_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_w2560_avif_sizes_w2560_avif_filename_idx\` ON \`media\` (\`sizes_w2560_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p640_sizes_p640_filename_idx\` ON \`media\` (\`sizes_p640_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p640_avif_sizes_p640_avif_filename_idx\` ON \`media\` (\`sizes_p640_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p828_sizes_p828_filename_idx\` ON \`media\` (\`sizes_p828_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p828_avif_sizes_p828_avif_filename_idx\` ON \`media\` (\`sizes_p828_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p1080_sizes_p1080_filename_idx\` ON \`media\` (\`sizes_p1080_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_p1080_avif_sizes_p1080_avif_filename_idx\` ON \`media\` (\`sizes_p1080_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_s640_sizes_s640_filename_idx\` ON \`media\` (\`sizes_s640_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_s640_avif_sizes_s640_avif_filename_idx\` ON \`media\` (\`sizes_s640_avif_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_s1080_sizes_s1080_filename_idx\` ON \`media\` (\`sizes_s1080_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_s1080_avif_sizes_s1080_avif_filename_idx\` ON \`media\` (\`sizes_s1080_avif_filename\`);`)
  await db.run(sql`CREATE TABLE \`testimonials\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`patient_label\` text,
  	\`service_id\` integer,
  	\`type\` text DEFAULT 'video',
  	\`video_id\` integer,
  	\`poster_id\` integer,
  	\`quote\` text,
  	\`transcript_summary\` text,
  	\`recorded_at\` text,
  	\`recordedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`duration_seconds\` numeric,
  	\`consent_confirmed\` integer DEFAULT false,
  	\`show_on_home\` integer DEFAULT false,
  	\`order\` numeric DEFAULT 100,
  	\`seed_key\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`video_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`testimonials_service_idx\` ON \`testimonials\` (\`service_id\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_video_idx\` ON \`testimonials\` (\`video_id\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_poster_idx\` ON \`testimonials\` (\`poster_id\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_order_idx\` ON \`testimonials\` (\`order\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`testimonials_seed_key_idx\` ON \`testimonials\` (\`seed_key\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_updated_at_idx\` ON \`testimonials\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_created_at_idx\` ON \`testimonials\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_deleted_at_idx\` ON \`testimonials\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonials__status_idx\` ON \`testimonials\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_testimonials_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_patient_label\` text,
  	\`version_service_id\` integer,
  	\`version_type\` text DEFAULT 'video',
  	\`version_video_id\` integer,
  	\`version_poster_id\` integer,
  	\`version_quote\` text,
  	\`version_transcript_summary\` text,
  	\`version_recorded_at\` text,
  	\`version_recordedat_tz\` text DEFAULT 'Asia/Tehran',
  	\`version_duration_seconds\` numeric,
  	\`version_consent_confirmed\` integer DEFAULT false,
  	\`version_show_on_home\` integer DEFAULT false,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_seed_key\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`testimonials\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_video_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_testimonials_v_parent_idx\` ON \`_testimonials_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_service_idx\` ON \`_testimonials_v\` (\`version_service_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_video_idx\` ON \`_testimonials_v\` (\`version_video_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_poster_idx\` ON \`_testimonials_v\` (\`version_poster_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_order_idx\` ON \`_testimonials_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_seed_key_idx\` ON \`_testimonials_v\` (\`version_seed_key\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_updated_at_idx\` ON \`_testimonials_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_created_at_idx\` ON \`_testimonials_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_deleted_at_idx\` ON \`_testimonials_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version__status_idx\` ON \`_testimonials_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_created_at_idx\` ON \`_testimonials_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_updated_at_idx\` ON \`_testimonials_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_latest_idx\` ON \`_testimonials_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`cases\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`service_id\` integer,
  	\`doctor_id\` integer,
  	\`before_id\` integer,
  	\`after_id\` integer,
  	\`notes\` text,
  	\`consent_confirmed\` integer DEFAULT false,
  	\`featured_on_home\` integer DEFAULT false,
  	\`order\` numeric DEFAULT 100,
  	\`source_folder\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`before_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`after_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`cases_service_idx\` ON \`cases\` (\`service_id\`);`)
  await db.run(sql`CREATE INDEX \`cases_doctor_idx\` ON \`cases\` (\`doctor_id\`);`)
  await db.run(sql`CREATE INDEX \`cases_before_idx\` ON \`cases\` (\`before_id\`);`)
  await db.run(sql`CREATE INDEX \`cases_after_idx\` ON \`cases\` (\`after_id\`);`)
  await db.run(sql`CREATE INDEX \`cases_order_idx\` ON \`cases\` (\`order\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`cases_source_folder_idx\` ON \`cases\` (\`source_folder\`);`)
  await db.run(sql`CREATE INDEX \`cases_updated_at_idx\` ON \`cases\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`cases_created_at_idx\` ON \`cases\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`cases_deleted_at_idx\` ON \`cases\` (\`deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`cases__status_idx\` ON \`cases\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_cases_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_service_id\` integer,
  	\`version_doctor_id\` integer,
  	\`version_before_id\` integer,
  	\`version_after_id\` integer,
  	\`version_notes\` text,
  	\`version_consent_confirmed\` integer DEFAULT false,
  	\`version_featured_on_home\` integer DEFAULT false,
  	\`version_order\` numeric DEFAULT 100,
  	\`version_source_folder\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`cases\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_service_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_doctor_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_before_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_after_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_cases_v_parent_idx\` ON \`_cases_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_service_idx\` ON \`_cases_v\` (\`version_service_id\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_doctor_idx\` ON \`_cases_v\` (\`version_doctor_id\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_before_idx\` ON \`_cases_v\` (\`version_before_id\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_after_idx\` ON \`_cases_v\` (\`version_after_id\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_order_idx\` ON \`_cases_v\` (\`version_order\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_source_folder_idx\` ON \`_cases_v\` (\`version_source_folder\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_updated_at_idx\` ON \`_cases_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_created_at_idx\` ON \`_cases_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version_deleted_at_idx\` ON \`_cases_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_version_version__status_idx\` ON \`_cases_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_created_at_idx\` ON \`_cases_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_updated_at_idx\` ON \`_cases_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_cases_v_latest_idx\` ON \`_cases_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`redirects\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`from\` text NOT NULL,
  	\`to\` text,
  	\`status_code\` text DEFAULT '301' NOT NULL,
  	\`active\` integer DEFAULT true,
  	\`source\` text DEFAULT 'manual' NOT NULL,
  	\`note\` text,
  	\`hits\` numeric DEFAULT 0,
  	\`last_hit_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`redirects_from_idx\` ON \`redirects\` (\`from\`);`)
  await db.run(sql`CREATE INDEX \`redirects_to_idx\` ON \`redirects\` (\`to\`);`)
  await db.run(sql`CREATE INDEX \`redirects_active_idx\` ON \`redirects\` (\`active\`);`)
  await db.run(sql`CREATE INDEX \`redirects_source_idx\` ON \`redirects\` (\`source\`);`)
  await db.run(sql`CREATE INDEX \`redirects_updated_at_idx\` ON \`redirects\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`redirects_created_at_idx\` ON \`redirects\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`_redirects_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_from\` text NOT NULL,
  	\`version_to\` text,
  	\`version_status_code\` text DEFAULT '301' NOT NULL,
  	\`version_active\` integer DEFAULT true,
  	\`version_source\` text DEFAULT 'manual' NOT NULL,
  	\`version_note\` text,
  	\`version_hits\` numeric DEFAULT 0,
  	\`version_last_hit_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_redirects_v_parent_idx\` ON \`_redirects_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_from_idx\` ON \`_redirects_v\` (\`version_from\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_to_idx\` ON \`_redirects_v\` (\`version_to\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_active_idx\` ON \`_redirects_v\` (\`version_active\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_source_idx\` ON \`_redirects_v\` (\`version_source\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_updated_at_idx\` ON \`_redirects_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_created_at_idx\` ON \`_redirects_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_created_at_idx\` ON \`_redirects_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_updated_at_idx\` ON \`_redirects_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`events_daily\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`date\` text NOT NULL,
  	\`event\` text NOT NULL,
  	\`location\` text DEFAULT 'none' NOT NULL,
  	\`page_type\` text DEFAULT 'other' NOT NULL,
  	\`service_key\` text DEFAULT 'none' NOT NULL,
  	\`count\` numeric DEFAULT 0 NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`events_daily_date_idx\` ON \`events_daily\` (\`date\`);`)
  await db.run(sql`CREATE INDEX \`events_daily_event_idx\` ON \`events_daily\` (\`event\`);`)
  await db.run(sql`CREATE INDEX \`events_daily_updated_at_idx\` ON \`events_daily\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`events_daily_created_at_idx\` ON \`events_daily\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`date_event_location_pageType_serviceKey_idx\` ON \`events_daily\` (\`date\`,\`event\`,\`location\`,\`page_type\`,\`service_key\`);`)
  await db.run(sql`CREATE TABLE \`audit_log\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`action\` text NOT NULL,
  	\`entity_type\` text NOT NULL,
  	\`entity_slug\` text NOT NULL,
  	\`doc_id\` text,
  	\`doc_label\` text,
  	\`status_from\` text,
  	\`status_to\` text,
  	\`actor_id\` integer,
  	\`actor_label\` text NOT NULL,
  	\`actor_role\` text,
  	\`request_id\` text,
  	\`ip_hash\` text,
  	\`note\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`audit_log_action_idx\` ON \`audit_log\` (\`action\`);`)
  await db.run(sql`CREATE INDEX \`audit_log_actor_idx\` ON \`audit_log\` (\`actor_id\`);`)
  await db.run(sql`CREATE INDEX \`audit_log_request_id_idx\` ON \`audit_log\` (\`request_id\`);`)
  await db.run(sql`CREATE INDEX \`audit_log_updated_at_idx\` ON \`audit_log\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`audit_log_created_at_idx\` ON \`audit_log\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`entitySlug_docId_idx\` ON \`audit_log\` (\`entity_slug\`,\`doc_id\`);`)
  await db.run(sql`CREATE INDEX \`actor_createdAt_idx\` ON \`audit_log\` (\`actor_id\`,\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`audit_log_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`audit_log\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`audit_log_texts_order_parent\` ON \`audit_log_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`role\` text DEFAULT 'editor' NOT NULL,
  	\`totp_secret\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_role_idx\` ON \`users\` (\`role\`);`)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`totp_attempts\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`attempts\` numeric DEFAULT 0 NOT NULL,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs_log\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`executed_at\` text NOT NULL,
  	\`completed_at\` text NOT NULL,
  	\`task_slug\` text NOT NULL,
  	\`task_i_d\` text NOT NULL,
  	\`input\` text,
  	\`output\` text,
  	\`state\` text NOT NULL,
  	\`error\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`payload_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`input\` text,
  	\`completed_at\` text,
  	\`total_tried\` numeric DEFAULT 0,
  	\`has_error\` integer DEFAULT false,
  	\`error\` text,
  	\`task_slug\` text,
  	\`queue\` text DEFAULT 'default',
  	\`wait_until\` text,
  	\`processing\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_processing_idx\` ON \`payload_jobs\` (\`processing\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`bookings_id\` integer,
  	\`pages_id\` integer,
  	\`service_categories_id\` integer,
  	\`services_id\` integer,
  	\`service_tiers_id\` integer,
  	\`doctors_id\` integer,
  	\`articles_id\` integer,
  	\`article_categories_id\` integer,
  	\`tags_id\` integer,
  	\`insurances_id\` integer,
  	\`financing_options_id\` integer,
  	\`media_id\` integer,
  	\`testimonials_id\` integer,
  	\`cases_id\` integer,
  	\`redirects_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`bookings_id\`) REFERENCES \`bookings\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`service_categories_id\`) REFERENCES \`service_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`service_tiers_id\`) REFERENCES \`service_tiers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`doctors_id\`) REFERENCES \`doctors\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`article_categories_id\`) REFERENCES \`article_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`insurances_id\`) REFERENCES \`insurances\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`financing_options_id\`) REFERENCES \`financing_options\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`testimonials_id\`) REFERENCES \`testimonials\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`cases_id\`) REFERENCES \`cases\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_bookings_id_idx\` ON \`payload_locked_documents_rels\` (\`bookings_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_service_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`service_categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_services_id_idx\` ON \`payload_locked_documents_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_service_tiers_id_idx\` ON \`payload_locked_documents_rels\` (\`service_tiers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_doctors_id_idx\` ON \`payload_locked_documents_rels\` (\`doctors_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_articles_id_idx\` ON \`payload_locked_documents_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_article_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`article_categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tags_id_idx\` ON \`payload_locked_documents_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_insurances_id_idx\` ON \`payload_locked_documents_rels\` (\`insurances_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_financing_options_id_idx\` ON \`payload_locked_documents_rels\` (\`financing_options_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_testimonials_id_idx\` ON \`payload_locked_documents_rels\` (\`testimonials_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_cases_id_idx\` ON \`payload_locked_documents_rels\` (\`cases_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`clinic_hours_weekly_days\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` text NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`clinic_hours_weekly\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`clinic_hours_weekly_days_order_idx\` ON \`clinic_hours_weekly_days\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`clinic_hours_weekly_days_parent_idx\` ON \`clinic_hours_weekly_days\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`clinic_hours_weekly\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`open\` text NOT NULL,
  	\`close\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`clinic\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`clinic_hours_weekly_order_idx\` ON \`clinic_hours_weekly\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`clinic_hours_weekly_parent_id_idx\` ON \`clinic_hours_weekly\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`clinic_hours_holidays\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`date_jalali\` text NOT NULL,
  	\`date\` text,
  	\`label_fa\` text NOT NULL,
  	\`open\` text,
  	\`close\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`clinic\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`clinic_hours_holidays_order_idx\` ON \`clinic_hours_holidays\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`clinic_hours_holidays_parent_id_idx\` ON \`clinic_hours_holidays\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`clinic\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name_fa\` text NOT NULL,
  	\`name_short_fa\` text,
  	\`name_en\` text,
  	\`tagline\` text,
  	\`tagline_approved\` integer DEFAULT false,
  	\`contact_headline\` text,
  	\`domain\` text NOT NULL,
  	\`address_full_fa\` text NOT NULL,
  	\`address_city\` text NOT NULL,
  	\`address_district\` text,
  	\`address_postal_code\` text,
  	\`address_lat\` numeric,
  	\`address_lng\` numeric,
  	\`address_access_notes\` text,
  	\`phones_landline\` text NOT NULL,
  	\`phones_mobile\` text,
  	\`phones_whatsapp\` text,
  	\`phones_whatsapp_verified\` integer DEFAULT false,
  	\`phones_telegram\` text,
  	\`phones_telegram_verified\` integer DEFAULT false,
  	\`reception_callback_minutes\` numeric DEFAULT 10 NOT NULL,
  	\`reception_caller_number\` text,
  	\`hours_note\` text,
  	\`social_instagram\` text,
  	\`social_telegram_channel\` text,
  	\`social_aparat\` text,
  	\`maps_google_maps_url\` text,
  	\`maps_neshan_url\` text,
  	\`maps_balad_url\` text,
  	\`maps_waze_url\` text,
  	\`maps_static_map_id\` integer,
  	\`stats_years_active_value\` numeric,
  	\`stats_years_active_verified\` integer DEFAULT false,
  	\`stats_specialist_dentists_value\` numeric,
  	\`stats_specialist_dentists_verified\` integer DEFAULT false,
  	\`stats_specialty_clinics_value\` numeric,
  	\`stats_specialty_clinics_verified\` integer DEFAULT false,
  	\`stats_insurers_value\` numeric,
  	\`stats_insurers_verified\` integer DEFAULT false,
  	\`legal_license_number\` text,
  	\`legal_technical_supervisor\` text,
  	\`emergency_policy\` text,
  	\`emergency_nearby24h_center\` text,
  	\`emergency_priority_promise_confirmed\` integer DEFAULT false,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`maps_static_map_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`clinic_maps_maps_static_map_idx\` ON \`clinic\` (\`maps_static_map_id\`);`)
  await db.run(sql`CREATE TABLE \`_clinic_v_version_hours_weekly_days\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_clinic_v_version_hours_weekly\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_weekly_days_order_idx\` ON \`_clinic_v_version_hours_weekly_days\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_weekly_days_parent_idx\` ON \`_clinic_v_version_hours_weekly_days\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_clinic_v_version_hours_weekly\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`open\` text NOT NULL,
  	\`close\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_clinic_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_weekly_order_idx\` ON \`_clinic_v_version_hours_weekly\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_weekly_parent_id_idx\` ON \`_clinic_v_version_hours_weekly\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_clinic_v_version_hours_holidays\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`date_jalali\` text NOT NULL,
  	\`date\` text,
  	\`label_fa\` text NOT NULL,
  	\`open\` text,
  	\`close\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_clinic_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_holidays_order_idx\` ON \`_clinic_v_version_hours_holidays\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_hours_holidays_parent_id_idx\` ON \`_clinic_v_version_hours_holidays\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_clinic_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_name_fa\` text NOT NULL,
  	\`version_name_short_fa\` text,
  	\`version_name_en\` text,
  	\`version_tagline\` text,
  	\`version_tagline_approved\` integer DEFAULT false,
  	\`version_contact_headline\` text,
  	\`version_domain\` text NOT NULL,
  	\`version_address_full_fa\` text NOT NULL,
  	\`version_address_city\` text NOT NULL,
  	\`version_address_district\` text,
  	\`version_address_postal_code\` text,
  	\`version_address_lat\` numeric,
  	\`version_address_lng\` numeric,
  	\`version_address_access_notes\` text,
  	\`version_phones_landline\` text NOT NULL,
  	\`version_phones_mobile\` text,
  	\`version_phones_whatsapp\` text,
  	\`version_phones_whatsapp_verified\` integer DEFAULT false,
  	\`version_phones_telegram\` text,
  	\`version_phones_telegram_verified\` integer DEFAULT false,
  	\`version_reception_callback_minutes\` numeric DEFAULT 10 NOT NULL,
  	\`version_reception_caller_number\` text,
  	\`version_hours_note\` text,
  	\`version_social_instagram\` text,
  	\`version_social_telegram_channel\` text,
  	\`version_social_aparat\` text,
  	\`version_maps_google_maps_url\` text,
  	\`version_maps_neshan_url\` text,
  	\`version_maps_balad_url\` text,
  	\`version_maps_waze_url\` text,
  	\`version_maps_static_map_id\` integer,
  	\`version_stats_years_active_value\` numeric,
  	\`version_stats_years_active_verified\` integer DEFAULT false,
  	\`version_stats_specialist_dentists_value\` numeric,
  	\`version_stats_specialist_dentists_verified\` integer DEFAULT false,
  	\`version_stats_specialty_clinics_value\` numeric,
  	\`version_stats_specialty_clinics_verified\` integer DEFAULT false,
  	\`version_stats_insurers_value\` numeric,
  	\`version_stats_insurers_verified\` integer DEFAULT false,
  	\`version_legal_license_number\` text,
  	\`version_legal_technical_supervisor\` text,
  	\`version_emergency_policy\` text,
  	\`version_emergency_nearby24h_center\` text,
  	\`version_emergency_priority_promise_confirmed\` integer DEFAULT false,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`version_maps_static_map_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_clinic_v_version_maps_version_maps_static_map_idx\` ON \`_clinic_v\` (\`version_maps_static_map_id\`);`)
  await db.run(sql`CREATE INDEX \`_clinic_v_created_at_idx\` ON \`_clinic_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_clinic_v_updated_at_idx\` ON \`_clinic_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`seo_defaults\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text DEFAULT 'کلینیک دندانپزشکی سفید' NOT NULL,
  	\`title_suffix\` text DEFAULT ' | کلینیک دندانپزشکی سفید' NOT NULL,
  	\`short_title_suffix\` text DEFAULT ' | کلینیک سفید' NOT NULL,
  	\`default_description\` text,
  	\`default_og_image_id\` integer,
  	\`gsc_verification\` text,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`seo_defaults_default_og_image_idx\` ON \`seo_defaults\` (\`default_og_image_id\`);`)
  await db.run(sql`CREATE TABLE \`seo_defaults_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`seo_defaults\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`seo_defaults_texts_order_parent\` ON \`seo_defaults_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_seo_defaults_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_site_name\` text DEFAULT 'کلینیک دندانپزشکی سفید' NOT NULL,
  	\`version_title_suffix\` text DEFAULT ' | کلینیک دندانپزشکی سفید' NOT NULL,
  	\`version_short_title_suffix\` text DEFAULT ' | کلینیک سفید' NOT NULL,
  	\`version_default_description\` text,
  	\`version_default_og_image_id\` integer,
  	\`version_gsc_verification\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`version_default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_seo_defaults_v_version_version_default_og_image_idx\` ON \`_seo_defaults_v\` (\`version_default_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_seo_defaults_v_created_at_idx\` ON \`_seo_defaults_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_seo_defaults_v_updated_at_idx\` ON \`_seo_defaults_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_seo_defaults_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_seo_defaults_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_seo_defaults_v_texts_order_parent\` ON \`_seo_defaults_v_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`features\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`free_consultation\` integer DEFAULT true,
  	\`emergency_enabled\` integer DEFAULT true,
  	\`intro_enabled\` integer DEFAULT true,
  	\`hero_mark_relief\` integer DEFAULT true,
  	\`ga4_enabled\` integer DEFAULT false,
  	\`ga4_measurement_id\` text,
  	\`quality_tier_override\` text DEFAULT 'auto' NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`_features_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_free_consultation\` integer DEFAULT true,
  	\`version_emergency_enabled\` integer DEFAULT true,
  	\`version_intro_enabled\` integer DEFAULT true,
  	\`version_hero_mark_relief\` integer DEFAULT true,
  	\`version_ga4_enabled\` integer DEFAULT false,
  	\`version_ga4_measurement_id\` text,
  	\`version_quality_tier_override\` text DEFAULT 'auto' NOT NULL,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`_features_v_created_at_idx\` ON \`_features_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_features_v_updated_at_idx\` ON \`_features_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`notifier_mail_recipients\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`email\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`notifier\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`notifier_mail_recipients_order_idx\` ON \`notifier_mail_recipients\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`notifier_mail_recipients_parent_id_idx\` ON \`notifier_mail_recipients\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`notifier_sms_admin_recipients\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`phone\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`notifier\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`notifier_sms_admin_recipients_order_idx\` ON \`notifier_sms_admin_recipients\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`notifier_sms_admin_recipients_parent_id_idx\` ON \`notifier_sms_admin_recipients\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`notifier\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`mail_enabled\` integer DEFAULT false,
  	\`telegram_enabled\` integer DEFAULT false,
  	\`telegram_chat_id\` text,
  	\`sms_enabled\` integer DEFAULT false,
  	\`sms_sender_number\` text,
  	\`sms_patient_confirmation\` integer DEFAULT false,
  	\`error_dedup_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`_notifier_v_version_mail_recipients\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`email\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_notifier_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_notifier_v_version_mail_recipients_order_idx\` ON \`_notifier_v_version_mail_recipients\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_notifier_v_version_mail_recipients_parent_id_idx\` ON \`_notifier_v_version_mail_recipients\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_notifier_v_version_sms_admin_recipients\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`phone\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_notifier_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_notifier_v_version_sms_admin_recipients_order_idx\` ON \`_notifier_v_version_sms_admin_recipients\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_notifier_v_version_sms_admin_recipients_parent_id_idx\` ON \`_notifier_v_version_sms_admin_recipients\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_notifier_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_mail_enabled\` integer DEFAULT false,
  	\`version_telegram_enabled\` integer DEFAULT false,
  	\`version_telegram_chat_id\` text,
  	\`version_sms_enabled\` integer DEFAULT false,
  	\`version_sms_sender_number\` text,
  	\`version_sms_patient_confirmation\` integer DEFAULT false,
  	\`version_error_dedup_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`_notifier_v_created_at_idx\` ON \`_notifier_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_notifier_v_updated_at_idx\` ON \`_notifier_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`system_state\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`last_cron_run_at\` text,
  	\`last_cron_ran_jobs\` numeric,
  	\`last_cron_failed\` numeric,
  	\`last_cron_duration_ms\` numeric,
  	\`last_cron_error\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`bookings_triage\`;`)
  await db.run(sql`DROP TABLE \`bookings_flags\`;`)
  await db.run(sql`DROP TABLE \`bookings_admin_notes\`;`)
  await db.run(sql`DROP TABLE \`bookings_duplicate_submissions\`;`)
  await db.run(sql`DROP TABLE \`bookings\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_facts_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_facts\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_callout\`;`)
  await db.run(sql`DROP TABLE \`pages_sources\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_facts_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_facts\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_callout\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_sources\`;`)
  await db.run(sql`DROP TABLE \`_pages_v\`;`)
  await db.run(sql`DROP TABLE \`service_categories\`;`)
  await db.run(sql`DROP TABLE \`_service_categories_v\`;`)
  await db.run(sql`DROP TABLE \`services_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`services_blocks_steps_items\`;`)
  await db.run(sql`DROP TABLE \`services_blocks_steps\`;`)
  await db.run(sql`DROP TABLE \`services_blocks_callout\`;`)
  await db.run(sql`DROP TABLE \`services_faqs\`;`)
  await db.run(sql`DROP TABLE \`services_sources\`;`)
  await db.run(sql`DROP TABLE \`services\`;`)
  await db.run(sql`DROP TABLE \`services_texts\`;`)
  await db.run(sql`DROP TABLE \`services_rels\`;`)
  await db.run(sql`DROP TABLE \`_services_v_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`_services_v_blocks_steps_items\`;`)
  await db.run(sql`DROP TABLE \`_services_v_blocks_steps\`;`)
  await db.run(sql`DROP TABLE \`_services_v_blocks_callout\`;`)
  await db.run(sql`DROP TABLE \`_services_v_version_faqs\`;`)
  await db.run(sql`DROP TABLE \`_services_v_version_sources\`;`)
  await db.run(sql`DROP TABLE \`_services_v\`;`)
  await db.run(sql`DROP TABLE \`_services_v_texts\`;`)
  await db.run(sql`DROP TABLE \`_services_v_rels\`;`)
  await db.run(sql`DROP TABLE \`service_tiers\`;`)
  await db.run(sql`DROP TABLE \`service_tiers_texts\`;`)
  await db.run(sql`DROP TABLE \`_service_tiers_v\`;`)
  await db.run(sql`DROP TABLE \`_service_tiers_v_texts\`;`)
  await db.run(sql`DROP TABLE \`doctors\`;`)
  await db.run(sql`DROP TABLE \`doctors_texts\`;`)
  await db.run(sql`DROP TABLE \`doctors_rels\`;`)
  await db.run(sql`DROP TABLE \`_doctors_v\`;`)
  await db.run(sql`DROP TABLE \`_doctors_v_texts\`;`)
  await db.run(sql`DROP TABLE \`_doctors_v_rels\`;`)
  await db.run(sql`DROP TABLE \`articles_sources\`;`)
  await db.run(sql`DROP TABLE \`articles_faqs\`;`)
  await db.run(sql`DROP TABLE \`articles\`;`)
  await db.run(sql`DROP TABLE \`articles_rels\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_version_sources\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_version_faqs\`;`)
  await db.run(sql`DROP TABLE \`_articles_v\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_rels\`;`)
  await db.run(sql`DROP TABLE \`article_categories\`;`)
  await db.run(sql`DROP TABLE \`_article_categories_v\`;`)
  await db.run(sql`DROP TABLE \`tags\`;`)
  await db.run(sql`DROP TABLE \`_tags_v\`;`)
  await db.run(sql`DROP TABLE \`insurances\`;`)
  await db.run(sql`DROP TABLE \`_insurances_v\`;`)
  await db.run(sql`DROP TABLE \`financing_options\`;`)
  await db.run(sql`DROP TABLE \`_financing_options_v\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`testimonials\`;`)
  await db.run(sql`DROP TABLE \`_testimonials_v\`;`)
  await db.run(sql`DROP TABLE \`cases\`;`)
  await db.run(sql`DROP TABLE \`_cases_v\`;`)
  await db.run(sql`DROP TABLE \`redirects\`;`)
  await db.run(sql`DROP TABLE \`_redirects_v\`;`)
  await db.run(sql`DROP TABLE \`events_daily\`;`)
  await db.run(sql`DROP TABLE \`audit_log\`;`)
  await db.run(sql`DROP TABLE \`audit_log_texts\`;`)
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`totp_attempts\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_log\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`clinic_hours_weekly_days\`;`)
  await db.run(sql`DROP TABLE \`clinic_hours_weekly\`;`)
  await db.run(sql`DROP TABLE \`clinic_hours_holidays\`;`)
  await db.run(sql`DROP TABLE \`clinic\`;`)
  await db.run(sql`DROP TABLE \`_clinic_v_version_hours_weekly_days\`;`)
  await db.run(sql`DROP TABLE \`_clinic_v_version_hours_weekly\`;`)
  await db.run(sql`DROP TABLE \`_clinic_v_version_hours_holidays\`;`)
  await db.run(sql`DROP TABLE \`_clinic_v\`;`)
  await db.run(sql`DROP TABLE \`seo_defaults\`;`)
  await db.run(sql`DROP TABLE \`seo_defaults_texts\`;`)
  await db.run(sql`DROP TABLE \`_seo_defaults_v\`;`)
  await db.run(sql`DROP TABLE \`_seo_defaults_v_texts\`;`)
  await db.run(sql`DROP TABLE \`features\`;`)
  await db.run(sql`DROP TABLE \`_features_v\`;`)
  await db.run(sql`DROP TABLE \`notifier_mail_recipients\`;`)
  await db.run(sql`DROP TABLE \`notifier_sms_admin_recipients\`;`)
  await db.run(sql`DROP TABLE \`notifier\`;`)
  await db.run(sql`DROP TABLE \`_notifier_v_version_mail_recipients\`;`)
  await db.run(sql`DROP TABLE \`_notifier_v_version_sms_admin_recipients\`;`)
  await db.run(sql`DROP TABLE \`_notifier_v\`;`)
  await db.run(sql`DROP TABLE \`system_state\`;`)
}
