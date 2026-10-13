import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bookings_triage" AS ENUM('severe_pain', 'swelling', 'broken', 'avulsion', 'bleeding');
  CREATE TYPE "public"."enum_bookings_flags" AS ENUM('honeypot', 'too_fast', 'ip_rate', 'emergency_ip_rate', 'restored', 'emergency_priority_removed', 'manual');
  CREATE TYPE "public"."enum_bookings_kind" AS ENUM('regular', 'emergency');
  CREATE TYPE "public"."enum_bookings_booking_group" AS ENUM('exam', 'cosmetic', 'implant', 'restore', 'root_canal', 'ortho', 'kids', 'other');
  CREATE TYPE "public"."enum_bookings_preferred_time" AS ENUM('morning', 'evening', 'any');
  CREATE TYPE "public"."enum_bookings_emergency_outcome" AS ENUM('truly_urgent', 'not_urgent');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('new', 'contacted', 'scheduled', 'done', 'cancelled', 'spam', 'suspicious');
  CREATE TYPE "public"."enum_bookings_form_location" AS ENUM('hero', 'block', 'dialog', 'page', 'emergency', 'admin');
  CREATE TYPE "public"."enum_bookings_heard_from" AS ENUM('google', 'maps', 'instagram', 'referral', 'returning', 'signage', 'directory', 'other');
  CREATE TYPE "public"."enum_bookings_device" AS ENUM('mobile', 'tablet', 'desktop', 'unknown');
  CREATE TYPE "public"."enum_pages_blocks_callout_tone" AS ENUM('info', 'warning');
  CREATE TYPE "public"."enum_pages_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum_pages_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_pages_key" AS ENUM('home', 'services-hub', 'dentists-hub', 'cases', 'pricing', 'guide-hub', 'guide-first-visit', 'guide-dental-fear', 'guide-aftercare', 'emergency', 'about', 'address', 'booking', 'booking-success', 'articles', 'privacy');
  CREATE TYPE "public"."enum_pages_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_callout_tone" AS ENUM('info', 'warning');
  CREATE TYPE "public"."enum__pages_v_version_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum__pages_v_version_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__pages_v_version_key" AS ENUM('home', 'services-hub', 'dentists-hub', 'cases', 'pricing', 'guide-hub', 'guide-first-visit', 'guide-dental-fear', 'guide-aftercare', 'emergency', 'about', 'address', 'booking', 'booking-success', 'articles', 'privacy');
  CREATE TYPE "public"."enum__pages_v_version_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_service_categories_accent" AS ENUM('cosmetic', 'surgery', 'restorative', 'ortho', 'kids');
  CREATE TYPE "public"."enum_service_categories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__service_categories_v_version_accent" AS ENUM('cosmetic', 'surgery', 'restorative', 'ortho', 'kids');
  CREATE TYPE "public"."enum__service_categories_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_services_blocks_callout_tone" AS ENUM('info', 'warning');
  CREATE TYPE "public"."enum_services_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum_services_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_services_booking_group" AS ENUM('exam', 'cosmetic', 'implant', 'restore', 'root_canal', 'ortho', 'kids', 'other');
  CREATE TYPE "public"."enum_services_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_services_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_blocks_callout_tone" AS ENUM('info', 'warning');
  CREATE TYPE "public"."enum__services_v_version_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum__services_v_version_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__services_v_version_booking_group" AS ENUM('exam', 'cosmetic', 'implant', 'restore', 'root_canal', 'ortho', 'kids', 'other');
  CREATE TYPE "public"."enum__services_v_version_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__services_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_service_tiers_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__service_tiers_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_doctors_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__doctors_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_articles_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum_articles_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_articles_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_articles_review_state" AS ENUM('writing', 'in_review', 'approved');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_version_sources_publisher" AS ENUM('ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT', 'journal', 'other');
  CREATE TYPE "public"."enum__articles_v_version_sources_accessedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__articles_v_version_reviewedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__articles_v_version_review_state" AS ENUM('writing', 'in_review', 'approved');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_insurances_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__insurances_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_financing_options_approval_status" AS ENUM('approved', 'pending');
  CREATE TYPE "public"."enum_financing_options_approvedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_financing_options_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__financing_options_v_version_approval_status" AS ENUM('approved', 'pending');
  CREATE TYPE "public"."enum__financing_options_v_version_approvedon_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__financing_options_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_testimonials_type" AS ENUM('video', 'text');
  CREATE TYPE "public"."enum_testimonials_recordedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum_testimonials_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__testimonials_v_version_type" AS ENUM('video', 'text');
  CREATE TYPE "public"."enum__testimonials_v_version_recordedat_tz" AS ENUM('Asia/Tehran');
  CREATE TYPE "public"."enum__testimonials_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_cases_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__cases_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_redirects_status_code" AS ENUM('301', '302', '308', '410');
  CREATE TYPE "public"."enum_redirects_source" AS ENUM('manual', 'slug_change', 'alias', 'import', 'auto_removed');
  CREATE TYPE "public"."enum__redirects_v_version_status_code" AS ENUM('301', '302', '308', '410');
  CREATE TYPE "public"."enum__redirects_v_version_source" AS ENUM('manual', 'slug_change', 'alias', 'import', 'auto_removed');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'update', 'publish', 'unpublish', 'trash', 'restore', 'delete', 'login', 'logout', 'forgot_password', 'seed');
  CREATE TYPE "public"."enum_audit_log_entity_type" AS ENUM('collection', 'global', 'auth', 'system');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_clinic_hours_weekly_days" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum__clinic_v_version_hours_weekly_days" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum_features_quality_tier_override" AS ENUM('auto', '0', '1', '2', '3');
  CREATE TYPE "public"."enum__features_v_version_quality_tier_override" AS ENUM('auto', '0', '1', '2', '3');
  CREATE TABLE "bookings_triage" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_bookings_triage",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "bookings_flags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_bookings_flags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "bookings_admin_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"author_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "bookings_duplicate_submissions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"name" varchar,
  	"note" varchar,
  	"service_key" varchar,
  	"preferred_time" varchar,
  	"source_url" varchar
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"list_title" varchar,
  	"phone" varchar NOT NULL,
  	"phone_national" varchar NOT NULL,
  	"name" varchar,
  	"kind" "enum_bookings_kind" DEFAULT 'regular' NOT NULL,
  	"booking_group" "enum_bookings_booking_group",
  	"service_id" integer,
  	"service_key" varchar,
  	"tier" varchar,
  	"doctor_id" integer,
  	"preferred_time" "enum_bookings_preferred_time",
  	"note" varchar,
  	"emergency_outcome" "enum_bookings_emergency_outcome",
  	"status" "enum_bookings_status" DEFAULT 'new' NOT NULL,
  	"form_location" "enum_bookings_form_location",
  	"heard_from" "enum_bookings_heard_from",
  	"callback_due_at" timestamp(3) with time zone,
  	"urgency_rank" numeric,
  	"handled_by_id" integer,
  	"handled_at" timestamp(3) with time zone,
  	"source_url" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"utm_term" varchar,
  	"utm_content" varchar,
  	"device" "enum_bookings_device",
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "pages_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_facts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "pages_blocks_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "enum_pages_blocks_callout_tone" DEFAULT 'info',
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum_pages_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum_pages_sources_accessedon_tz" DEFAULT 'Asia/Tehran'
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum_pages_key",
  	"title" varchar,
  	"slug" varchar,
  	"path" varchar,
  	"lead" varchar,
  	"hero_photo_id" integer,
  	"hero_photo_portrait_id" integer,
  	"hero_subtext" varchar,
  	"hero_media_id" integer,
  	"reviewer_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewedat_tz" "enum_pages_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_facts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "enum__pages_v_blocks_callout_tone" DEFAULT 'info',
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum__pages_v_version_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum__pages_v_version_sources_accessedon_tz" DEFAULT 'Asia/Tehran',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" "enum__pages_v_version_key",
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_path" varchar,
  	"version_lead" varchar,
  	"version_hero_photo_id" integer,
  	"version_hero_photo_portrait_id" integer,
  	"version_hero_subtext" varchar,
  	"version_hero_media_id" integer,
  	"version_reviewer_id" integer,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_reviewedat_tz" "enum__pages_v_version_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "service_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"title" varchar,
  	"h1" varchar,
  	"nav_label" varchar,
  	"standalone" boolean DEFAULT false,
  	"standalone_service_id" integer,
  	"slug" varchar,
  	"accent" "enum_service_categories_accent",
  	"icon" varchar,
  	"summary" varchar,
  	"order" numeric DEFAULT 100,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_service_categories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_service_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_title" varchar,
  	"version_h1" varchar,
  	"version_nav_label" varchar,
  	"version_standalone" boolean DEFAULT false,
  	"version_standalone_service_id" integer,
  	"version_slug" varchar,
  	"version_accent" "enum__service_categories_v_version_accent",
  	"version_icon" varchar,
  	"version_summary" varchar,
  	"version_order" numeric DEFAULT 100,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__service_categories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "services_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "services_blocks_steps_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "services_blocks_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "services_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "enum_services_blocks_callout_tone" DEFAULT 'info',
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "services_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "services_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum_services_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum_services_sources_accessedon_tz" DEFAULT 'Asia/Tehran'
  );
  
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"category_id" integer,
  	"nav_label" varchar,
  	"h1" varchar,
  	"slug" varchar,
  	"booking_group" "enum_services_booking_group",
  	"priority" numeric,
  	"order" numeric DEFAULT 100,
  	"emergency_link" boolean DEFAULT false,
  	"summary" varchar,
  	"hero_media_id" integer,
  	"facts_sessions" varchar,
  	"facts_duration" varchar,
  	"facts_anesthesia" varchar,
  	"facts_recovery" varchar,
  	"price_from" numeric,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewedat_tz" "enum_services_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"is_medical" boolean DEFAULT true,
  	"internal_note" varchar,
  	"scope_verified" boolean DEFAULT true,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_services_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "services_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "services_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"services_id" integer
  );
  
  CREATE TABLE "_services_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_services_v_blocks_steps_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_services_v_blocks_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_services_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "enum__services_v_blocks_callout_tone" DEFAULT 'info',
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_services_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_services_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum__services_v_version_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum__services_v_version_sources_accessedon_tz" DEFAULT 'Asia/Tehran',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_services_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_category_id" integer,
  	"version_nav_label" varchar,
  	"version_h1" varchar,
  	"version_slug" varchar,
  	"version_booking_group" "enum__services_v_version_booking_group",
  	"version_priority" numeric,
  	"version_order" numeric DEFAULT 100,
  	"version_emergency_link" boolean DEFAULT false,
  	"version_summary" varchar,
  	"version_hero_media_id" integer,
  	"version_facts_sessions" varchar,
  	"version_facts_duration" varchar,
  	"version_facts_anesthesia" varchar,
  	"version_facts_recovery" varchar,
  	"version_price_from" numeric,
  	"version_reviewed_by_id" integer,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_reviewedat_tz" "enum__services_v_version_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"version_is_medical" boolean DEFAULT true,
  	"version_internal_note" varchar,
  	"version_scope_verified" boolean DEFAULT true,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__services_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_services_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_services_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"services_id" integer
  );
  
  CREATE TABLE "service_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"service_id" integer,
  	"key" varchar,
  	"name" varchar,
  	"description" varchar,
  	"materials" varchar,
  	"price_from" numeric,
  	"order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_service_tiers_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "service_tiers_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_service_tiers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_service_id" integer,
  	"version_key" varchar,
  	"version_name" varchar,
  	"version_description" varchar,
  	"version_materials" varchar,
  	"version_price_from" numeric,
  	"version_order" numeric DEFAULT 100,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__service_tiers_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_service_tiers_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "doctors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"specialty" varchar,
  	"specialty_confirmed" boolean DEFAULT false,
  	"council_number" varchar,
  	"years_experience" numeric,
  	"bio" varchar,
  	"photo_id" integer,
  	"order" numeric DEFAULT 100,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_doctors_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "doctors_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "doctors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"services_id" integer
  );
  
  CREATE TABLE "_doctors_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_specialty" varchar,
  	"version_specialty_confirmed" boolean DEFAULT false,
  	"version_council_number" varchar,
  	"version_years_experience" numeric,
  	"version_bio" varchar,
  	"version_photo_id" integer,
  	"version_order" numeric DEFAULT 100,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__doctors_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_doctors_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_doctors_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"services_id" integer
  );
  
  CREATE TABLE "articles_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum_articles_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum_articles_sources_accessedon_tz" DEFAULT 'Asia/Tehran'
  );
  
  CREATE TABLE "articles_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"cover_id" integer,
  	"body" jsonb,
  	"category_id" integer,
  	"primary_service_id" integer,
  	"author_doctor_id" integer,
  	"staff_author_name" varchar,
  	"is_medical" boolean DEFAULT true,
  	"reviewer_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewedat_tz" "enum_articles_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"reading_time" numeric,
  	"published_at" timestamp(3) with time zone,
  	"content_updated_at" timestamp(3) with time zone,
  	"review_state" "enum_articles_review_state" DEFAULT 'writing',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "_articles_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"publisher" "enum__articles_v_version_sources_publisher",
  	"url" varchar,
  	"accessed_on" timestamp(3) with time zone,
  	"accessedon_tz" "enum__articles_v_version_sources_accessedon_tz" DEFAULT 'Asia/Tehran',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_cover_id" integer,
  	"version_body" jsonb,
  	"version_category_id" integer,
  	"version_primary_service_id" integer,
  	"version_author_doctor_id" integer,
  	"version_staff_author_name" varchar,
  	"version_is_medical" boolean DEFAULT true,
  	"version_reviewer_id" integer,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_reviewedat_tz" "enum__articles_v_version_reviewedat_tz" DEFAULT 'Asia/Tehran',
  	"version_reading_time" numeric,
  	"version_published_at" timestamp(3) with time zone,
  	"version_content_updated_at" timestamp(3) with time zone,
  	"version_review_state" "enum__articles_v_version_review_state" DEFAULT 'writing',
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "article_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_article_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_description" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_tags_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_description" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "insurances" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"logo_id" integer,
  	"featured" boolean DEFAULT false,
  	"order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_insurances_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_insurances_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_logo_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_order" numeric DEFAULT 100,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__insurances_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "financing_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"title" varchar,
  	"provider" varchar,
  	"max_amount_toman" numeric,
  	"who_applies" varchar,
  	"surcharge_note" varchar,
  	"terms" varchar,
  	"approval_status" "enum_financing_options_approval_status" DEFAULT 'pending',
  	"approved_on" timestamp(3) with time zone,
  	"approvedon_tz" "enum_financing_options_approvedon_tz" DEFAULT 'Asia/Tehran',
  	"enabled" boolean DEFAULT false,
  	"order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_financing_options_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_financing_options_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_title" varchar,
  	"version_provider" varchar,
  	"version_max_amount_toman" numeric,
  	"version_who_applies" varchar,
  	"version_surcharge_note" varchar,
  	"version_terms" varchar,
  	"version_approval_status" "enum__financing_options_v_version_approval_status" DEFAULT 'pending',
  	"version_approved_on" timestamp(3) with time zone,
  	"version_approvedon_tz" "enum__financing_options_v_version_approvedon_tz" DEFAULT 'Asia/Tehran',
  	"version_enabled" boolean DEFAULT false,
  	"version_order" numeric DEFAULT 100,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__financing_options_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar,
  	"blur_data_u_r_l" varchar,
  	"blur_data_u_r_l_portrait" varchar,
  	"seed_source" varchar,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_w640_url" varchar,
  	"sizes_w640_width" numeric,
  	"sizes_w640_height" numeric,
  	"sizes_w640_mime_type" varchar,
  	"sizes_w640_filesize" numeric,
  	"sizes_w640_filename" varchar,
  	"sizes_w640_avif_url" varchar,
  	"sizes_w640_avif_width" numeric,
  	"sizes_w640_avif_height" numeric,
  	"sizes_w640_avif_mime_type" varchar,
  	"sizes_w640_avif_filesize" numeric,
  	"sizes_w640_avif_filename" varchar,
  	"sizes_w960_url" varchar,
  	"sizes_w960_width" numeric,
  	"sizes_w960_height" numeric,
  	"sizes_w960_mime_type" varchar,
  	"sizes_w960_filesize" numeric,
  	"sizes_w960_filename" varchar,
  	"sizes_w960_avif_url" varchar,
  	"sizes_w960_avif_width" numeric,
  	"sizes_w960_avif_height" numeric,
  	"sizes_w960_avif_mime_type" varchar,
  	"sizes_w960_avif_filesize" numeric,
  	"sizes_w960_avif_filename" varchar,
  	"sizes_w1280_url" varchar,
  	"sizes_w1280_width" numeric,
  	"sizes_w1280_height" numeric,
  	"sizes_w1280_mime_type" varchar,
  	"sizes_w1280_filesize" numeric,
  	"sizes_w1280_filename" varchar,
  	"sizes_w1280_avif_url" varchar,
  	"sizes_w1280_avif_width" numeric,
  	"sizes_w1280_avif_height" numeric,
  	"sizes_w1280_avif_mime_type" varchar,
  	"sizes_w1280_avif_filesize" numeric,
  	"sizes_w1280_avif_filename" varchar,
  	"sizes_w1600_url" varchar,
  	"sizes_w1600_width" numeric,
  	"sizes_w1600_height" numeric,
  	"sizes_w1600_mime_type" varchar,
  	"sizes_w1600_filesize" numeric,
  	"sizes_w1600_filename" varchar,
  	"sizes_w1600_avif_url" varchar,
  	"sizes_w1600_avif_width" numeric,
  	"sizes_w1600_avif_height" numeric,
  	"sizes_w1600_avif_mime_type" varchar,
  	"sizes_w1600_avif_filesize" numeric,
  	"sizes_w1600_avif_filename" varchar,
  	"sizes_w1920_url" varchar,
  	"sizes_w1920_width" numeric,
  	"sizes_w1920_height" numeric,
  	"sizes_w1920_mime_type" varchar,
  	"sizes_w1920_filesize" numeric,
  	"sizes_w1920_filename" varchar,
  	"sizes_w1920_avif_url" varchar,
  	"sizes_w1920_avif_width" numeric,
  	"sizes_w1920_avif_height" numeric,
  	"sizes_w1920_avif_mime_type" varchar,
  	"sizes_w1920_avif_filesize" numeric,
  	"sizes_w1920_avif_filename" varchar,
  	"sizes_w2560_url" varchar,
  	"sizes_w2560_width" numeric,
  	"sizes_w2560_height" numeric,
  	"sizes_w2560_mime_type" varchar,
  	"sizes_w2560_filesize" numeric,
  	"sizes_w2560_filename" varchar,
  	"sizes_w2560_avif_url" varchar,
  	"sizes_w2560_avif_width" numeric,
  	"sizes_w2560_avif_height" numeric,
  	"sizes_w2560_avif_mime_type" varchar,
  	"sizes_w2560_avif_filesize" numeric,
  	"sizes_w2560_avif_filename" varchar,
  	"sizes_p640_url" varchar,
  	"sizes_p640_width" numeric,
  	"sizes_p640_height" numeric,
  	"sizes_p640_mime_type" varchar,
  	"sizes_p640_filesize" numeric,
  	"sizes_p640_filename" varchar,
  	"sizes_p640_avif_url" varchar,
  	"sizes_p640_avif_width" numeric,
  	"sizes_p640_avif_height" numeric,
  	"sizes_p640_avif_mime_type" varchar,
  	"sizes_p640_avif_filesize" numeric,
  	"sizes_p640_avif_filename" varchar,
  	"sizes_p828_url" varchar,
  	"sizes_p828_width" numeric,
  	"sizes_p828_height" numeric,
  	"sizes_p828_mime_type" varchar,
  	"sizes_p828_filesize" numeric,
  	"sizes_p828_filename" varchar,
  	"sizes_p828_avif_url" varchar,
  	"sizes_p828_avif_width" numeric,
  	"sizes_p828_avif_height" numeric,
  	"sizes_p828_avif_mime_type" varchar,
  	"sizes_p828_avif_filesize" numeric,
  	"sizes_p828_avif_filename" varchar,
  	"sizes_p1080_url" varchar,
  	"sizes_p1080_width" numeric,
  	"sizes_p1080_height" numeric,
  	"sizes_p1080_mime_type" varchar,
  	"sizes_p1080_filesize" numeric,
  	"sizes_p1080_filename" varchar,
  	"sizes_p1080_avif_url" varchar,
  	"sizes_p1080_avif_width" numeric,
  	"sizes_p1080_avif_height" numeric,
  	"sizes_p1080_avif_mime_type" varchar,
  	"sizes_p1080_avif_filesize" numeric,
  	"sizes_p1080_avif_filename" varchar,
  	"sizes_s640_url" varchar,
  	"sizes_s640_width" numeric,
  	"sizes_s640_height" numeric,
  	"sizes_s640_mime_type" varchar,
  	"sizes_s640_filesize" numeric,
  	"sizes_s640_filename" varchar,
  	"sizes_s640_avif_url" varchar,
  	"sizes_s640_avif_width" numeric,
  	"sizes_s640_avif_height" numeric,
  	"sizes_s640_avif_mime_type" varchar,
  	"sizes_s640_avif_filesize" numeric,
  	"sizes_s640_avif_filename" varchar,
  	"sizes_s1080_url" varchar,
  	"sizes_s1080_width" numeric,
  	"sizes_s1080_height" numeric,
  	"sizes_s1080_mime_type" varchar,
  	"sizes_s1080_filesize" numeric,
  	"sizes_s1080_filename" varchar,
  	"sizes_s1080_avif_url" varchar,
  	"sizes_s1080_avif_width" numeric,
  	"sizes_s1080_avif_height" numeric,
  	"sizes_s1080_avif_mime_type" varchar,
  	"sizes_s1080_avif_filesize" numeric,
  	"sizes_s1080_avif_filename" varchar
  );
  
  CREATE TABLE "testimonials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"patient_label" varchar,
  	"service_id" integer,
  	"type" "enum_testimonials_type" DEFAULT 'video',
  	"video_id" integer,
  	"poster_id" integer,
  	"quote" varchar,
  	"transcript_summary" varchar,
  	"recorded_at" timestamp(3) with time zone,
  	"recordedat_tz" "enum_testimonials_recordedat_tz" DEFAULT 'Asia/Tehran',
  	"duration_seconds" numeric,
  	"consent_confirmed" boolean DEFAULT false,
  	"show_on_home" boolean DEFAULT false,
  	"order" numeric DEFAULT 100,
  	"seed_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_testimonials_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_testimonials_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_patient_label" varchar,
  	"version_service_id" integer,
  	"version_type" "enum__testimonials_v_version_type" DEFAULT 'video',
  	"version_video_id" integer,
  	"version_poster_id" integer,
  	"version_quote" varchar,
  	"version_transcript_summary" varchar,
  	"version_recorded_at" timestamp(3) with time zone,
  	"version_recordedat_tz" "enum__testimonials_v_version_recordedat_tz" DEFAULT 'Asia/Tehran',
  	"version_duration_seconds" numeric,
  	"version_consent_confirmed" boolean DEFAULT false,
  	"version_show_on_home" boolean DEFAULT false,
  	"version_order" numeric DEFAULT 100,
  	"version_seed_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__testimonials_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"service_id" integer,
  	"doctor_id" integer,
  	"before_id" integer,
  	"after_id" integer,
  	"notes" varchar,
  	"consent_confirmed" boolean DEFAULT false,
  	"featured_on_home" boolean DEFAULT false,
  	"order" numeric DEFAULT 100,
  	"source_folder" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_cases_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_cases_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_service_id" integer,
  	"version_doctor_id" integer,
  	"version_before_id" integer,
  	"version_after_id" integer,
  	"version_notes" varchar,
  	"version_consent_confirmed" boolean DEFAULT false,
  	"version_featured_on_home" boolean DEFAULT false,
  	"version_order" numeric DEFAULT 100,
  	"version_source_folder" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__cases_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar,
  	"status_code" "enum_redirects_status_code" DEFAULT '301' NOT NULL,
  	"active" boolean DEFAULT true,
  	"source" "enum_redirects_source" DEFAULT 'manual' NOT NULL,
  	"note" varchar,
  	"hits" numeric DEFAULT 0,
  	"last_hit_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_redirects_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_from" varchar NOT NULL,
  	"version_to" varchar,
  	"version_status_code" "enum__redirects_v_version_status_code" DEFAULT '301' NOT NULL,
  	"version_active" boolean DEFAULT true,
  	"version_source" "enum__redirects_v_version_source" DEFAULT 'manual' NOT NULL,
  	"version_note" varchar,
  	"version_hits" numeric DEFAULT 0,
  	"version_last_hit_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events_daily" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"event" varchar NOT NULL,
  	"location" varchar DEFAULT 'none' NOT NULL,
  	"page_type" varchar DEFAULT 'other' NOT NULL,
  	"service_key" varchar DEFAULT 'none' NOT NULL,
  	"count" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"entity_type" "enum_audit_log_entity_type" NOT NULL,
  	"entity_slug" varchar NOT NULL,
  	"doc_id" varchar,
  	"doc_label" varchar,
  	"status_from" varchar,
  	"status_to" varchar,
  	"actor_id" integer,
  	"actor_label" varchar NOT NULL,
  	"actor_role" varchar,
  	"request_id" varchar,
  	"ip_hash" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"totp_secret" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "totp_attempts" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"bookings_id" integer,
  	"pages_id" integer,
  	"service_categories_id" integer,
  	"services_id" integer,
  	"service_tiers_id" integer,
  	"doctors_id" integer,
  	"articles_id" integer,
  	"article_categories_id" integer,
  	"tags_id" integer,
  	"insurances_id" integer,
  	"financing_options_id" integer,
  	"media_id" integer,
  	"testimonials_id" integer,
  	"cases_id" integer,
  	"redirects_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clinic_hours_weekly_days" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_clinic_hours_weekly_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "clinic_hours_weekly" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"open" varchar NOT NULL,
  	"close" varchar NOT NULL
  );
  
  CREATE TABLE "clinic_hours_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date_jalali" varchar NOT NULL,
  	"date" varchar,
  	"label_fa" varchar NOT NULL,
  	"open" varchar,
  	"close" varchar
  );
  
  CREATE TABLE "clinic" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name_fa" varchar NOT NULL,
  	"name_short_fa" varchar,
  	"name_en" varchar,
  	"tagline" varchar,
  	"tagline_approved" boolean DEFAULT false,
  	"contact_headline" varchar,
  	"domain" varchar NOT NULL,
  	"address_full_fa" varchar NOT NULL,
  	"address_city" varchar NOT NULL,
  	"address_district" varchar,
  	"address_postal_code" varchar,
  	"address_lat" numeric,
  	"address_lng" numeric,
  	"address_access_notes" varchar,
  	"phones_landline" varchar NOT NULL,
  	"phones_mobile" varchar,
  	"phones_whatsapp" varchar,
  	"phones_whatsapp_verified" boolean DEFAULT false,
  	"phones_telegram" varchar,
  	"phones_telegram_verified" boolean DEFAULT false,
  	"reception_callback_minutes" numeric DEFAULT 10 NOT NULL,
  	"reception_caller_number" varchar,
  	"hours_note" varchar,
  	"social_instagram" varchar,
  	"social_telegram_channel" varchar,
  	"social_aparat" varchar,
  	"maps_google_maps_url" varchar,
  	"maps_neshan_url" varchar,
  	"maps_balad_url" varchar,
  	"maps_waze_url" varchar,
  	"maps_static_map_id" integer,
  	"stats_years_active_value" numeric,
  	"stats_years_active_verified" boolean DEFAULT false,
  	"stats_specialist_dentists_value" numeric,
  	"stats_specialist_dentists_verified" boolean DEFAULT false,
  	"stats_specialty_clinics_value" numeric,
  	"stats_specialty_clinics_verified" boolean DEFAULT false,
  	"stats_insurers_value" numeric,
  	"stats_insurers_verified" boolean DEFAULT false,
  	"legal_license_number" varchar,
  	"legal_technical_supervisor" varchar,
  	"emergency_policy" varchar,
  	"emergency_nearby24h_center" varchar,
  	"emergency_priority_promise_confirmed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_clinic_v_version_hours_weekly_days" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__clinic_v_version_hours_weekly_days",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_clinic_v_version_hours_weekly" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"open" varchar NOT NULL,
  	"close" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_clinic_v_version_hours_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date_jalali" varchar NOT NULL,
  	"date" varchar,
  	"label_fa" varchar NOT NULL,
  	"open" varchar,
  	"close" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_clinic_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_name_fa" varchar NOT NULL,
  	"version_name_short_fa" varchar,
  	"version_name_en" varchar,
  	"version_tagline" varchar,
  	"version_tagline_approved" boolean DEFAULT false,
  	"version_contact_headline" varchar,
  	"version_domain" varchar NOT NULL,
  	"version_address_full_fa" varchar NOT NULL,
  	"version_address_city" varchar NOT NULL,
  	"version_address_district" varchar,
  	"version_address_postal_code" varchar,
  	"version_address_lat" numeric,
  	"version_address_lng" numeric,
  	"version_address_access_notes" varchar,
  	"version_phones_landline" varchar NOT NULL,
  	"version_phones_mobile" varchar,
  	"version_phones_whatsapp" varchar,
  	"version_phones_whatsapp_verified" boolean DEFAULT false,
  	"version_phones_telegram" varchar,
  	"version_phones_telegram_verified" boolean DEFAULT false,
  	"version_reception_callback_minutes" numeric DEFAULT 10 NOT NULL,
  	"version_reception_caller_number" varchar,
  	"version_hours_note" varchar,
  	"version_social_instagram" varchar,
  	"version_social_telegram_channel" varchar,
  	"version_social_aparat" varchar,
  	"version_maps_google_maps_url" varchar,
  	"version_maps_neshan_url" varchar,
  	"version_maps_balad_url" varchar,
  	"version_maps_waze_url" varchar,
  	"version_maps_static_map_id" integer,
  	"version_stats_years_active_value" numeric,
  	"version_stats_years_active_verified" boolean DEFAULT false,
  	"version_stats_specialist_dentists_value" numeric,
  	"version_stats_specialist_dentists_verified" boolean DEFAULT false,
  	"version_stats_specialty_clinics_value" numeric,
  	"version_stats_specialty_clinics_verified" boolean DEFAULT false,
  	"version_stats_insurers_value" numeric,
  	"version_stats_insurers_verified" boolean DEFAULT false,
  	"version_legal_license_number" varchar,
  	"version_legal_technical_supervisor" varchar,
  	"version_emergency_policy" varchar,
  	"version_emergency_nearby24h_center" varchar,
  	"version_emergency_priority_promise_confirmed" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seo_defaults" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'کلینیک دندانپزشکی سفید' NOT NULL,
  	"title_suffix" varchar DEFAULT ' | کلینیک دندانپزشکی سفید' NOT NULL,
  	"short_title_suffix" varchar DEFAULT ' | کلینیک سفید' NOT NULL,
  	"default_description" varchar,
  	"default_og_image_id" integer,
  	"gsc_verification" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "seo_defaults_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_seo_defaults_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_site_name" varchar DEFAULT 'کلینیک دندانپزشکی سفید' NOT NULL,
  	"version_title_suffix" varchar DEFAULT ' | کلینیک دندانپزشکی سفید' NOT NULL,
  	"version_short_title_suffix" varchar DEFAULT ' | کلینیک سفید' NOT NULL,
  	"version_default_description" varchar,
  	"version_default_og_image_id" integer,
  	"version_gsc_verification" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_seo_defaults_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "features" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"free_consultation" boolean DEFAULT true,
  	"emergency_enabled" boolean DEFAULT true,
  	"intro_enabled" boolean DEFAULT true,
  	"hero_mark_relief" boolean DEFAULT true,
  	"ga4_enabled" boolean DEFAULT false,
  	"ga4_measurement_id" varchar,
  	"quality_tier_override" "enum_features_quality_tier_override" DEFAULT 'auto' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_features_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_free_consultation" boolean DEFAULT true,
  	"version_emergency_enabled" boolean DEFAULT true,
  	"version_intro_enabled" boolean DEFAULT true,
  	"version_hero_mark_relief" boolean DEFAULT true,
  	"version_ga4_enabled" boolean DEFAULT false,
  	"version_ga4_measurement_id" varchar,
  	"version_quality_tier_override" "enum__features_v_version_quality_tier_override" DEFAULT 'auto' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifier_mail_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "notifier_sms_admin_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL
  );
  
  CREATE TABLE "notifier" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mail_enabled" boolean DEFAULT false,
  	"telegram_enabled" boolean DEFAULT false,
  	"telegram_chat_id" varchar,
  	"sms_enabled" boolean DEFAULT false,
  	"sms_sender_number" varchar,
  	"sms_patient_confirmation" boolean DEFAULT false,
  	"error_dedup_minutes" numeric DEFAULT 60 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_notifier_v_version_mail_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_notifier_v_version_sms_admin_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_notifier_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_mail_enabled" boolean DEFAULT false,
  	"version_telegram_enabled" boolean DEFAULT false,
  	"version_telegram_chat_id" varchar,
  	"version_sms_enabled" boolean DEFAULT false,
  	"version_sms_sender_number" varchar,
  	"version_sms_patient_confirmation" boolean DEFAULT false,
  	"version_error_dedup_minutes" numeric DEFAULT 60 NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "system_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"last_cron_run_at" timestamp(3) with time zone,
  	"last_cron_ran_jobs" numeric,
  	"last_cron_failed" numeric,
  	"last_cron_duration_ms" numeric,
  	"last_cron_error" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "bookings_triage" ADD CONSTRAINT "bookings_triage_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_flags" ADD CONSTRAINT "bookings_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_admin_notes" ADD CONSTRAINT "bookings_admin_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_admin_notes" ADD CONSTRAINT "bookings_admin_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_duplicate_submissions" ADD CONSTRAINT "bookings_duplicate_submissions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_content" ADD CONSTRAINT "pages_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_items" ADD CONSTRAINT "pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_facts_items" ADD CONSTRAINT "pages_blocks_facts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_facts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_facts" ADD CONSTRAINT "pages_blocks_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_callout" ADD CONSTRAINT "pages_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_sources" ADD CONSTRAINT "pages_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_photo_id_media_id_fk" FOREIGN KEY ("hero_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_photo_portrait_id_media_id_fk" FOREIGN KEY ("hero_photo_portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_reviewer_id_doctors_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content" ADD CONSTRAINT "_pages_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_items" ADD CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq" ADD CONSTRAINT "_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_facts_items" ADD CONSTRAINT "_pages_v_blocks_facts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_facts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_facts" ADD CONSTRAINT "_pages_v_blocks_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_callout" ADD CONSTRAINT "_pages_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sources" ADD CONSTRAINT "_pages_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_photo_id_media_id_fk" FOREIGN KEY ("version_hero_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_photo_portrait_id_media_id_fk" FOREIGN KEY ("version_hero_photo_portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_reviewer_id_doctors_id_fk" FOREIGN KEY ("version_reviewer_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_standalone_service_id_services_id_fk" FOREIGN KEY ("standalone_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_categories_v" ADD CONSTRAINT "_service_categories_v_parent_id_service_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_categories_v" ADD CONSTRAINT "_service_categories_v_version_standalone_service_id_services_id_fk" FOREIGN KEY ("version_standalone_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_categories_v" ADD CONSTRAINT "_service_categories_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_blocks_content" ADD CONSTRAINT "services_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_blocks_steps_items" ADD CONSTRAINT "services_blocks_steps_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services_blocks_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_blocks_steps" ADD CONSTRAINT "services_blocks_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_blocks_callout" ADD CONSTRAINT "services_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_faqs" ADD CONSTRAINT "services_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_sources" ADD CONSTRAINT "services_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_reviewed_by_id_doctors_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_texts" ADD CONSTRAINT "services_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_blocks_content" ADD CONSTRAINT "_services_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_blocks_steps_items" ADD CONSTRAINT "_services_v_blocks_steps_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v_blocks_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_blocks_steps" ADD CONSTRAINT "_services_v_blocks_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_blocks_callout" ADD CONSTRAINT "_services_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_version_faqs" ADD CONSTRAINT "_services_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_version_sources" ADD CONSTRAINT "_services_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_parent_id_services_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_category_id_service_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_reviewed_by_id_doctors_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v_texts" ADD CONSTRAINT "_services_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_rels" ADD CONSTRAINT "_services_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_rels" ADD CONSTRAINT "_services_v_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_tiers" ADD CONSTRAINT "service_tiers_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_tiers_texts" ADD CONSTRAINT "service_tiers_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_service_tiers_v" ADD CONSTRAINT "_service_tiers_v_parent_id_service_tiers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_tiers_v" ADD CONSTRAINT "_service_tiers_v_version_service_id_services_id_fk" FOREIGN KEY ("version_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_tiers_v_texts" ADD CONSTRAINT "_service_tiers_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_service_tiers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctors" ADD CONSTRAINT "doctors_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctors" ADD CONSTRAINT "doctors_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doctors_texts" ADD CONSTRAINT "doctors_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctors_rels" ADD CONSTRAINT "doctors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctors_rels" ADD CONSTRAINT "doctors_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_doctors_v" ADD CONSTRAINT "_doctors_v_parent_id_doctors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_doctors_v" ADD CONSTRAINT "_doctors_v_version_photo_id_media_id_fk" FOREIGN KEY ("version_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_doctors_v" ADD CONSTRAINT "_doctors_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_doctors_v_texts" ADD CONSTRAINT "_doctors_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_doctors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_doctors_v_rels" ADD CONSTRAINT "_doctors_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_doctors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_doctors_v_rels" ADD CONSTRAINT "_doctors_v_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_sources" ADD CONSTRAINT "articles_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_faqs" ADD CONSTRAINT "articles_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."article_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_primary_service_id_services_id_fk" FOREIGN KEY ("primary_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_author_doctor_id_doctors_id_fk" FOREIGN KEY ("author_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_reviewer_id_doctors_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_sources" ADD CONSTRAINT "_articles_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_faqs" ADD CONSTRAINT "_articles_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_category_id_article_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."article_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_primary_service_id_services_id_fk" FOREIGN KEY ("version_primary_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_author_doctor_id_doctors_id_fk" FOREIGN KEY ("version_author_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_reviewer_id_doctors_id_fk" FOREIGN KEY ("version_reviewer_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_article_categories_v" ADD CONSTRAINT "_article_categories_v_parent_id_article_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."article_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_article_categories_v" ADD CONSTRAINT "_article_categories_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tags_v" ADD CONSTRAINT "_tags_v_parent_id_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tags_v" ADD CONSTRAINT "_tags_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insurances" ADD CONSTRAINT "insurances_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insurances_v" ADD CONSTRAINT "_insurances_v_parent_id_insurances_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insurances"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insurances_v" ADD CONSTRAINT "_insurances_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_financing_options_v" ADD CONSTRAINT "_financing_options_v_parent_id_financing_options_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."financing_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_testimonials_v" ADD CONSTRAINT "_testimonials_v_parent_id_testimonials_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."testimonials"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_testimonials_v" ADD CONSTRAINT "_testimonials_v_version_service_id_services_id_fk" FOREIGN KEY ("version_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_testimonials_v" ADD CONSTRAINT "_testimonials_v_version_video_id_media_id_fk" FOREIGN KEY ("version_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_testimonials_v" ADD CONSTRAINT "_testimonials_v_version_poster_id_media_id_fk" FOREIGN KEY ("version_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cases" ADD CONSTRAINT "cases_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cases" ADD CONSTRAINT "cases_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cases" ADD CONSTRAINT "cases_before_id_media_id_fk" FOREIGN KEY ("before_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cases" ADD CONSTRAINT "cases_after_id_media_id_fk" FOREIGN KEY ("after_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_cases_v" ADD CONSTRAINT "_cases_v_parent_id_cases_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_cases_v" ADD CONSTRAINT "_cases_v_version_service_id_services_id_fk" FOREIGN KEY ("version_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_cases_v" ADD CONSTRAINT "_cases_v_version_doctor_id_doctors_id_fk" FOREIGN KEY ("version_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_cases_v" ADD CONSTRAINT "_cases_v_version_before_id_media_id_fk" FOREIGN KEY ("version_before_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_cases_v" ADD CONSTRAINT "_cases_v_version_after_id_media_id_fk" FOREIGN KEY ("version_after_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_redirects_v" ADD CONSTRAINT "_redirects_v_parent_id_redirects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redirects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log_texts" ADD CONSTRAINT "audit_log_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_categories_fk" FOREIGN KEY ("service_categories_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_tiers_fk" FOREIGN KEY ("service_tiers_id") REFERENCES "public"."service_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doctors_fk" FOREIGN KEY ("doctors_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_article_categories_fk" FOREIGN KEY ("article_categories_id") REFERENCES "public"."article_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_insurances_fk" FOREIGN KEY ("insurances_id") REFERENCES "public"."insurances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_financing_options_fk" FOREIGN KEY ("financing_options_id") REFERENCES "public"."financing_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_testimonials_fk" FOREIGN KEY ("testimonials_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cases_fk" FOREIGN KEY ("cases_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_hours_weekly_days" ADD CONSTRAINT "clinic_hours_weekly_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_hours_weekly"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_hours_weekly" ADD CONSTRAINT "clinic_hours_weekly_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clinic"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_hours_holidays" ADD CONSTRAINT "clinic_hours_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clinic"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic" ADD CONSTRAINT "clinic_maps_static_map_id_media_id_fk" FOREIGN KEY ("maps_static_map_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_clinic_v_version_hours_weekly_days" ADD CONSTRAINT "_clinic_v_version_hours_weekly_days_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_clinic_v_version_hours_weekly"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_clinic_v_version_hours_weekly" ADD CONSTRAINT "_clinic_v_version_hours_weekly_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_clinic_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_clinic_v_version_hours_holidays" ADD CONSTRAINT "_clinic_v_version_hours_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_clinic_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_clinic_v" ADD CONSTRAINT "_clinic_v_version_maps_static_map_id_media_id_fk" FOREIGN KEY ("version_maps_static_map_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seo_defaults" ADD CONSTRAINT "seo_defaults_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seo_defaults_texts" ADD CONSTRAINT "seo_defaults_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."seo_defaults"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_seo_defaults_v" ADD CONSTRAINT "_seo_defaults_v_version_default_og_image_id_media_id_fk" FOREIGN KEY ("version_default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_seo_defaults_v_texts" ADD CONSTRAINT "_seo_defaults_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_seo_defaults_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifier_mail_recipients" ADD CONSTRAINT "notifier_mail_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."notifier"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifier_sms_admin_recipients" ADD CONSTRAINT "notifier_sms_admin_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."notifier"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_notifier_v_version_mail_recipients" ADD CONSTRAINT "_notifier_v_version_mail_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_notifier_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_notifier_v_version_sms_admin_recipients" ADD CONSTRAINT "_notifier_v_version_sms_admin_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_notifier_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bookings_triage_order_idx" ON "bookings_triage" USING btree ("order");
  CREATE INDEX "bookings_triage_parent_idx" ON "bookings_triage" USING btree ("parent_id");
  CREATE INDEX "bookings_flags_order_idx" ON "bookings_flags" USING btree ("order");
  CREATE INDEX "bookings_flags_parent_idx" ON "bookings_flags" USING btree ("parent_id");
  CREATE INDEX "bookings_admin_notes_order_idx" ON "bookings_admin_notes" USING btree ("_order");
  CREATE INDEX "bookings_admin_notes_parent_id_idx" ON "bookings_admin_notes" USING btree ("_parent_id");
  CREATE INDEX "bookings_admin_notes_author_idx" ON "bookings_admin_notes" USING btree ("author_id");
  CREATE INDEX "bookings_duplicate_submissions_order_idx" ON "bookings_duplicate_submissions" USING btree ("_order");
  CREATE INDEX "bookings_duplicate_submissions_parent_id_idx" ON "bookings_duplicate_submissions" USING btree ("_parent_id");
  CREATE INDEX "bookings_phone_idx" ON "bookings" USING btree ("phone");
  CREATE INDEX "bookings_phone_national_idx" ON "bookings" USING btree ("phone_national");
  CREATE INDEX "bookings_kind_idx" ON "bookings" USING btree ("kind");
  CREATE INDEX "bookings_booking_group_idx" ON "bookings" USING btree ("booking_group");
  CREATE INDEX "bookings_service_idx" ON "bookings" USING btree ("service_id");
  CREATE INDEX "bookings_doctor_idx" ON "bookings" USING btree ("doctor_id");
  CREATE INDEX "bookings_emergency_outcome_idx" ON "bookings" USING btree ("emergency_outcome");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "bookings_heard_from_idx" ON "bookings" USING btree ("heard_from");
  CREATE INDEX "bookings_callback_due_at_idx" ON "bookings" USING btree ("callback_due_at");
  CREATE INDEX "bookings_urgency_rank_idx" ON "bookings" USING btree ("urgency_rank");
  CREATE INDEX "bookings_handled_by_idx" ON "bookings" USING btree ("handled_by_id");
  CREATE INDEX "bookings_ip_hash_idx" ON "bookings" USING btree ("ip_hash");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "bookings_deleted_at_idx" ON "bookings" USING btree ("deleted_at");
  CREATE INDEX "phone_createdAt_idx" ON "bookings" USING btree ("phone","created_at");
  CREATE INDEX "ipHash_createdAt_idx" ON "bookings" USING btree ("ip_hash","created_at");
  CREATE INDEX "status_createdAt_idx" ON "bookings" USING btree ("status","created_at");
  CREATE INDEX "pages_blocks_content_order_idx" ON "pages_blocks_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_parent_id_idx" ON "pages_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_path_idx" ON "pages_blocks_content" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_items_order_idx" ON "pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_items_parent_id_idx" ON "pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE INDEX "pages_blocks_facts_items_order_idx" ON "pages_blocks_facts_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_facts_items_parent_id_idx" ON "pages_blocks_facts_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_facts_order_idx" ON "pages_blocks_facts" USING btree ("_order");
  CREATE INDEX "pages_blocks_facts_parent_id_idx" ON "pages_blocks_facts" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_facts_path_idx" ON "pages_blocks_facts" USING btree ("_path");
  CREATE INDEX "pages_blocks_callout_order_idx" ON "pages_blocks_callout" USING btree ("_order");
  CREATE INDEX "pages_blocks_callout_parent_id_idx" ON "pages_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_callout_path_idx" ON "pages_blocks_callout" USING btree ("_path");
  CREATE INDEX "pages_sources_order_idx" ON "pages_sources" USING btree ("_order");
  CREATE INDEX "pages_sources_parent_id_idx" ON "pages_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_key_idx" ON "pages" USING btree ("key");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE UNIQUE INDEX "pages_path_idx" ON "pages" USING btree ("path");
  CREATE INDEX "pages_hero_hero_photo_idx" ON "pages" USING btree ("hero_photo_id");
  CREATE INDEX "pages_hero_hero_photo_portrait_idx" ON "pages" USING btree ("hero_photo_portrait_id");
  CREATE INDEX "pages_hero_media_idx" ON "pages" USING btree ("hero_media_id");
  CREATE INDEX "pages_reviewer_idx" ON "pages" USING btree ("reviewer_id");
  CREATE INDEX "pages_seo_seo_image_idx" ON "pages" USING btree ("seo_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_blocks_content_order_idx" ON "_pages_v_blocks_content" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_content_parent_id_idx" ON "_pages_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_content_path_idx" ON "_pages_v_blocks_content" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_items_order_idx" ON "_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_items_parent_id_idx" ON "_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_order_idx" ON "_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_parent_id_idx" ON "_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_path_idx" ON "_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_facts_items_order_idx" ON "_pages_v_blocks_facts_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_facts_items_parent_id_idx" ON "_pages_v_blocks_facts_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_facts_order_idx" ON "_pages_v_blocks_facts" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_facts_parent_id_idx" ON "_pages_v_blocks_facts" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_facts_path_idx" ON "_pages_v_blocks_facts" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_callout_order_idx" ON "_pages_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_callout_parent_id_idx" ON "_pages_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_callout_path_idx" ON "_pages_v_blocks_callout" USING btree ("_path");
  CREATE INDEX "_pages_v_version_sources_order_idx" ON "_pages_v_version_sources" USING btree ("_order");
  CREATE INDEX "_pages_v_version_sources_parent_id_idx" ON "_pages_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_key_idx" ON "_pages_v" USING btree ("version_key");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_path_idx" ON "_pages_v" USING btree ("version_path");
  CREATE INDEX "_pages_v_version_hero_version_hero_photo_idx" ON "_pages_v" USING btree ("version_hero_photo_id");
  CREATE INDEX "_pages_v_version_hero_version_hero_photo_portrait_idx" ON "_pages_v" USING btree ("version_hero_photo_portrait_id");
  CREATE INDEX "_pages_v_version_version_hero_media_idx" ON "_pages_v" USING btree ("version_hero_media_id");
  CREATE INDEX "_pages_v_version_version_reviewer_idx" ON "_pages_v" USING btree ("version_reviewer_id");
  CREATE INDEX "_pages_v_version_seo_version_seo_image_idx" ON "_pages_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "_pages_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "service_categories_key_idx" ON "service_categories" USING btree ("key");
  CREATE INDEX "service_categories_standalone_service_idx" ON "service_categories" USING btree ("standalone_service_id");
  CREATE UNIQUE INDEX "service_categories_slug_idx" ON "service_categories" USING btree ("slug");
  CREATE INDEX "service_categories_order_idx" ON "service_categories" USING btree ("order");
  CREATE INDEX "service_categories_seo_seo_image_idx" ON "service_categories" USING btree ("seo_image_id");
  CREATE INDEX "service_categories_updated_at_idx" ON "service_categories" USING btree ("updated_at");
  CREATE INDEX "service_categories_created_at_idx" ON "service_categories" USING btree ("created_at");
  CREATE INDEX "service_categories_deleted_at_idx" ON "service_categories" USING btree ("deleted_at");
  CREATE INDEX "service_categories__status_idx" ON "service_categories" USING btree ("_status");
  CREATE INDEX "_service_categories_v_parent_idx" ON "_service_categories_v" USING btree ("parent_id");
  CREATE INDEX "_service_categories_v_version_version_key_idx" ON "_service_categories_v" USING btree ("version_key");
  CREATE INDEX "_service_categories_v_version_version_standalone_service_idx" ON "_service_categories_v" USING btree ("version_standalone_service_id");
  CREATE INDEX "_service_categories_v_version_version_slug_idx" ON "_service_categories_v" USING btree ("version_slug");
  CREATE INDEX "_service_categories_v_version_version_order_idx" ON "_service_categories_v" USING btree ("version_order");
  CREATE INDEX "_service_categories_v_version_seo_version_seo_image_idx" ON "_service_categories_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_service_categories_v_version_version_updated_at_idx" ON "_service_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_service_categories_v_version_version_created_at_idx" ON "_service_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_service_categories_v_version_version_deleted_at_idx" ON "_service_categories_v" USING btree ("version_deleted_at");
  CREATE INDEX "_service_categories_v_version_version__status_idx" ON "_service_categories_v" USING btree ("version__status");
  CREATE INDEX "_service_categories_v_created_at_idx" ON "_service_categories_v" USING btree ("created_at");
  CREATE INDEX "_service_categories_v_updated_at_idx" ON "_service_categories_v" USING btree ("updated_at");
  CREATE INDEX "_service_categories_v_latest_idx" ON "_service_categories_v" USING btree ("latest");
  CREATE INDEX "services_blocks_content_order_idx" ON "services_blocks_content" USING btree ("_order");
  CREATE INDEX "services_blocks_content_parent_id_idx" ON "services_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "services_blocks_content_path_idx" ON "services_blocks_content" USING btree ("_path");
  CREATE INDEX "services_blocks_steps_items_order_idx" ON "services_blocks_steps_items" USING btree ("_order");
  CREATE INDEX "services_blocks_steps_items_parent_id_idx" ON "services_blocks_steps_items" USING btree ("_parent_id");
  CREATE INDEX "services_blocks_steps_order_idx" ON "services_blocks_steps" USING btree ("_order");
  CREATE INDEX "services_blocks_steps_parent_id_idx" ON "services_blocks_steps" USING btree ("_parent_id");
  CREATE INDEX "services_blocks_steps_path_idx" ON "services_blocks_steps" USING btree ("_path");
  CREATE INDEX "services_blocks_callout_order_idx" ON "services_blocks_callout" USING btree ("_order");
  CREATE INDEX "services_blocks_callout_parent_id_idx" ON "services_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "services_blocks_callout_path_idx" ON "services_blocks_callout" USING btree ("_path");
  CREATE INDEX "services_faqs_order_idx" ON "services_faqs" USING btree ("_order");
  CREATE INDEX "services_faqs_parent_id_idx" ON "services_faqs" USING btree ("_parent_id");
  CREATE INDEX "services_sources_order_idx" ON "services_sources" USING btree ("_order");
  CREATE INDEX "services_sources_parent_id_idx" ON "services_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "services_key_idx" ON "services" USING btree ("key");
  CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id");
  CREATE UNIQUE INDEX "services_slug_idx" ON "services" USING btree ("slug");
  CREATE INDEX "services_booking_group_idx" ON "services" USING btree ("booking_group");
  CREATE INDEX "services_priority_idx" ON "services" USING btree ("priority");
  CREATE INDEX "services_order_idx" ON "services" USING btree ("order");
  CREATE INDEX "services_hero_media_idx" ON "services" USING btree ("hero_media_id");
  CREATE INDEX "services_reviewed_by_idx" ON "services" USING btree ("reviewed_by_id");
  CREATE INDEX "services_seo_seo_image_idx" ON "services" USING btree ("seo_image_id");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX "services_deleted_at_idx" ON "services" USING btree ("deleted_at");
  CREATE INDEX "services__status_idx" ON "services" USING btree ("_status");
  CREATE INDEX "services_texts_order_parent" ON "services_texts" USING btree ("order","parent_id");
  CREATE INDEX "services_rels_order_idx" ON "services_rels" USING btree ("order");
  CREATE INDEX "services_rels_parent_idx" ON "services_rels" USING btree ("parent_id");
  CREATE INDEX "services_rels_path_idx" ON "services_rels" USING btree ("path");
  CREATE INDEX "services_rels_services_id_idx" ON "services_rels" USING btree ("services_id");
  CREATE INDEX "_services_v_blocks_content_order_idx" ON "_services_v_blocks_content" USING btree ("_order");
  CREATE INDEX "_services_v_blocks_content_parent_id_idx" ON "_services_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "_services_v_blocks_content_path_idx" ON "_services_v_blocks_content" USING btree ("_path");
  CREATE INDEX "_services_v_blocks_steps_items_order_idx" ON "_services_v_blocks_steps_items" USING btree ("_order");
  CREATE INDEX "_services_v_blocks_steps_items_parent_id_idx" ON "_services_v_blocks_steps_items" USING btree ("_parent_id");
  CREATE INDEX "_services_v_blocks_steps_order_idx" ON "_services_v_blocks_steps" USING btree ("_order");
  CREATE INDEX "_services_v_blocks_steps_parent_id_idx" ON "_services_v_blocks_steps" USING btree ("_parent_id");
  CREATE INDEX "_services_v_blocks_steps_path_idx" ON "_services_v_blocks_steps" USING btree ("_path");
  CREATE INDEX "_services_v_blocks_callout_order_idx" ON "_services_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_services_v_blocks_callout_parent_id_idx" ON "_services_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_services_v_blocks_callout_path_idx" ON "_services_v_blocks_callout" USING btree ("_path");
  CREATE INDEX "_services_v_version_faqs_order_idx" ON "_services_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_services_v_version_faqs_parent_id_idx" ON "_services_v_version_faqs" USING btree ("_parent_id");
  CREATE INDEX "_services_v_version_sources_order_idx" ON "_services_v_version_sources" USING btree ("_order");
  CREATE INDEX "_services_v_version_sources_parent_id_idx" ON "_services_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_services_v_parent_idx" ON "_services_v" USING btree ("parent_id");
  CREATE INDEX "_services_v_version_version_key_idx" ON "_services_v" USING btree ("version_key");
  CREATE INDEX "_services_v_version_version_category_idx" ON "_services_v" USING btree ("version_category_id");
  CREATE INDEX "_services_v_version_version_slug_idx" ON "_services_v" USING btree ("version_slug");
  CREATE INDEX "_services_v_version_version_booking_group_idx" ON "_services_v" USING btree ("version_booking_group");
  CREATE INDEX "_services_v_version_version_priority_idx" ON "_services_v" USING btree ("version_priority");
  CREATE INDEX "_services_v_version_version_order_idx" ON "_services_v" USING btree ("version_order");
  CREATE INDEX "_services_v_version_version_hero_media_idx" ON "_services_v" USING btree ("version_hero_media_id");
  CREATE INDEX "_services_v_version_version_reviewed_by_idx" ON "_services_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_services_v_version_seo_version_seo_image_idx" ON "_services_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_services_v_version_version_updated_at_idx" ON "_services_v" USING btree ("version_updated_at");
  CREATE INDEX "_services_v_version_version_created_at_idx" ON "_services_v" USING btree ("version_created_at");
  CREATE INDEX "_services_v_version_version_deleted_at_idx" ON "_services_v" USING btree ("version_deleted_at");
  CREATE INDEX "_services_v_version_version__status_idx" ON "_services_v" USING btree ("version__status");
  CREATE INDEX "_services_v_created_at_idx" ON "_services_v" USING btree ("created_at");
  CREATE INDEX "_services_v_updated_at_idx" ON "_services_v" USING btree ("updated_at");
  CREATE INDEX "_services_v_latest_idx" ON "_services_v" USING btree ("latest");
  CREATE INDEX "_services_v_texts_order_parent" ON "_services_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_services_v_rels_order_idx" ON "_services_v_rels" USING btree ("order");
  CREATE INDEX "_services_v_rels_parent_idx" ON "_services_v_rels" USING btree ("parent_id");
  CREATE INDEX "_services_v_rels_path_idx" ON "_services_v_rels" USING btree ("path");
  CREATE INDEX "_services_v_rels_services_id_idx" ON "_services_v_rels" USING btree ("services_id");
  CREATE INDEX "service_tiers_service_idx" ON "service_tiers" USING btree ("service_id");
  CREATE INDEX "service_tiers_order_idx" ON "service_tiers" USING btree ("order");
  CREATE INDEX "service_tiers_updated_at_idx" ON "service_tiers" USING btree ("updated_at");
  CREATE INDEX "service_tiers_created_at_idx" ON "service_tiers" USING btree ("created_at");
  CREATE INDEX "service_tiers_deleted_at_idx" ON "service_tiers" USING btree ("deleted_at");
  CREATE INDEX "service_tiers__status_idx" ON "service_tiers" USING btree ("_status");
  CREATE UNIQUE INDEX "service_key_idx" ON "service_tiers" USING btree ("service_id","key");
  CREATE INDEX "service_tiers_texts_order_parent" ON "service_tiers_texts" USING btree ("order","parent_id");
  CREATE INDEX "_service_tiers_v_parent_idx" ON "_service_tiers_v" USING btree ("parent_id");
  CREATE INDEX "_service_tiers_v_version_version_service_idx" ON "_service_tiers_v" USING btree ("version_service_id");
  CREATE INDEX "_service_tiers_v_version_version_order_idx" ON "_service_tiers_v" USING btree ("version_order");
  CREATE INDEX "_service_tiers_v_version_version_updated_at_idx" ON "_service_tiers_v" USING btree ("version_updated_at");
  CREATE INDEX "_service_tiers_v_version_version_created_at_idx" ON "_service_tiers_v" USING btree ("version_created_at");
  CREATE INDEX "_service_tiers_v_version_version_deleted_at_idx" ON "_service_tiers_v" USING btree ("version_deleted_at");
  CREATE INDEX "_service_tiers_v_version_version__status_idx" ON "_service_tiers_v" USING btree ("version__status");
  CREATE INDEX "_service_tiers_v_created_at_idx" ON "_service_tiers_v" USING btree ("created_at");
  CREATE INDEX "_service_tiers_v_updated_at_idx" ON "_service_tiers_v" USING btree ("updated_at");
  CREATE INDEX "_service_tiers_v_latest_idx" ON "_service_tiers_v" USING btree ("latest");
  CREATE INDEX "version_service_version_key_idx" ON "_service_tiers_v" USING btree ("version_service_id","version_key");
  CREATE INDEX "_service_tiers_v_texts_order_parent" ON "_service_tiers_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "doctors_slug_idx" ON "doctors" USING btree ("slug");
  CREATE UNIQUE INDEX "doctors_council_number_idx" ON "doctors" USING btree ("council_number");
  CREATE INDEX "doctors_photo_idx" ON "doctors" USING btree ("photo_id");
  CREATE INDEX "doctors_order_idx" ON "doctors" USING btree ("order");
  CREATE INDEX "doctors_seo_seo_image_idx" ON "doctors" USING btree ("seo_image_id");
  CREATE INDEX "doctors_updated_at_idx" ON "doctors" USING btree ("updated_at");
  CREATE INDEX "doctors_created_at_idx" ON "doctors" USING btree ("created_at");
  CREATE INDEX "doctors_deleted_at_idx" ON "doctors" USING btree ("deleted_at");
  CREATE INDEX "doctors__status_idx" ON "doctors" USING btree ("_status");
  CREATE INDEX "doctors_texts_order_parent" ON "doctors_texts" USING btree ("order","parent_id");
  CREATE INDEX "doctors_rels_order_idx" ON "doctors_rels" USING btree ("order");
  CREATE INDEX "doctors_rels_parent_idx" ON "doctors_rels" USING btree ("parent_id");
  CREATE INDEX "doctors_rels_path_idx" ON "doctors_rels" USING btree ("path");
  CREATE INDEX "doctors_rels_services_id_idx" ON "doctors_rels" USING btree ("services_id");
  CREATE INDEX "_doctors_v_parent_idx" ON "_doctors_v" USING btree ("parent_id");
  CREATE INDEX "_doctors_v_version_version_slug_idx" ON "_doctors_v" USING btree ("version_slug");
  CREATE INDEX "_doctors_v_version_version_council_number_idx" ON "_doctors_v" USING btree ("version_council_number");
  CREATE INDEX "_doctors_v_version_version_photo_idx" ON "_doctors_v" USING btree ("version_photo_id");
  CREATE INDEX "_doctors_v_version_version_order_idx" ON "_doctors_v" USING btree ("version_order");
  CREATE INDEX "_doctors_v_version_seo_version_seo_image_idx" ON "_doctors_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_doctors_v_version_version_updated_at_idx" ON "_doctors_v" USING btree ("version_updated_at");
  CREATE INDEX "_doctors_v_version_version_created_at_idx" ON "_doctors_v" USING btree ("version_created_at");
  CREATE INDEX "_doctors_v_version_version_deleted_at_idx" ON "_doctors_v" USING btree ("version_deleted_at");
  CREATE INDEX "_doctors_v_version_version__status_idx" ON "_doctors_v" USING btree ("version__status");
  CREATE INDEX "_doctors_v_created_at_idx" ON "_doctors_v" USING btree ("created_at");
  CREATE INDEX "_doctors_v_updated_at_idx" ON "_doctors_v" USING btree ("updated_at");
  CREATE INDEX "_doctors_v_latest_idx" ON "_doctors_v" USING btree ("latest");
  CREATE INDEX "_doctors_v_texts_order_parent" ON "_doctors_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_doctors_v_rels_order_idx" ON "_doctors_v_rels" USING btree ("order");
  CREATE INDEX "_doctors_v_rels_parent_idx" ON "_doctors_v_rels" USING btree ("parent_id");
  CREATE INDEX "_doctors_v_rels_path_idx" ON "_doctors_v_rels" USING btree ("path");
  CREATE INDEX "_doctors_v_rels_services_id_idx" ON "_doctors_v_rels" USING btree ("services_id");
  CREATE INDEX "articles_sources_order_idx" ON "articles_sources" USING btree ("_order");
  CREATE INDEX "articles_sources_parent_id_idx" ON "articles_sources" USING btree ("_parent_id");
  CREATE INDEX "articles_faqs_order_idx" ON "articles_faqs" USING btree ("_order");
  CREATE INDEX "articles_faqs_parent_id_idx" ON "articles_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_cover_idx" ON "articles" USING btree ("cover_id");
  CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category_id");
  CREATE INDEX "articles_primary_service_idx" ON "articles" USING btree ("primary_service_id");
  CREATE INDEX "articles_author_doctor_idx" ON "articles" USING btree ("author_doctor_id");
  CREATE INDEX "articles_reviewer_idx" ON "articles" USING btree ("reviewer_id");
  CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");
  CREATE INDEX "articles_review_state_idx" ON "articles" USING btree ("review_state");
  CREATE INDEX "articles_seo_seo_image_idx" ON "articles" USING btree ("seo_image_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles_deleted_at_idx" ON "articles" USING btree ("deleted_at");
  CREATE INDEX "articles__status_idx" ON "articles" USING btree ("_status");
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_tags_id_idx" ON "articles_rels" USING btree ("tags_id");
  CREATE INDEX "articles_rels_articles_id_idx" ON "articles_rels" USING btree ("articles_id");
  CREATE INDEX "_articles_v_version_sources_order_idx" ON "_articles_v_version_sources" USING btree ("_order");
  CREATE INDEX "_articles_v_version_sources_parent_id_idx" ON "_articles_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_faqs_order_idx" ON "_articles_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_articles_v_version_faqs_parent_id_idx" ON "_articles_v_version_faqs" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_cover_idx" ON "_articles_v" USING btree ("version_cover_id");
  CREATE INDEX "_articles_v_version_version_category_idx" ON "_articles_v" USING btree ("version_category_id");
  CREATE INDEX "_articles_v_version_version_primary_service_idx" ON "_articles_v" USING btree ("version_primary_service_id");
  CREATE INDEX "_articles_v_version_version_author_doctor_idx" ON "_articles_v" USING btree ("version_author_doctor_id");
  CREATE INDEX "_articles_v_version_version_reviewer_idx" ON "_articles_v" USING btree ("version_reviewer_id");
  CREATE INDEX "_articles_v_version_version_published_at_idx" ON "_articles_v" USING btree ("version_published_at");
  CREATE INDEX "_articles_v_version_version_review_state_idx" ON "_articles_v" USING btree ("version_review_state");
  CREATE INDEX "_articles_v_version_seo_version_seo_image_idx" ON "_articles_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version_deleted_at_idx" ON "_articles_v" USING btree ("version_deleted_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE INDEX "_articles_v_autosave_idx" ON "_articles_v" USING btree ("autosave");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_tags_id_idx" ON "_articles_v_rels" USING btree ("tags_id");
  CREATE INDEX "_articles_v_rels_articles_id_idx" ON "_articles_v_rels" USING btree ("articles_id");
  CREATE UNIQUE INDEX "article_categories_slug_idx" ON "article_categories" USING btree ("slug");
  CREATE INDEX "article_categories_seo_seo_image_idx" ON "article_categories" USING btree ("seo_image_id");
  CREATE INDEX "article_categories_updated_at_idx" ON "article_categories" USING btree ("updated_at");
  CREATE INDEX "article_categories_created_at_idx" ON "article_categories" USING btree ("created_at");
  CREATE INDEX "article_categories_deleted_at_idx" ON "article_categories" USING btree ("deleted_at");
  CREATE INDEX "_article_categories_v_parent_idx" ON "_article_categories_v" USING btree ("parent_id");
  CREATE INDEX "_article_categories_v_version_version_slug_idx" ON "_article_categories_v" USING btree ("version_slug");
  CREATE INDEX "_article_categories_v_version_seo_version_seo_image_idx" ON "_article_categories_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_article_categories_v_version_version_updated_at_idx" ON "_article_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_article_categories_v_version_version_created_at_idx" ON "_article_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_article_categories_v_version_version_deleted_at_idx" ON "_article_categories_v" USING btree ("version_deleted_at");
  CREATE INDEX "_article_categories_v_created_at_idx" ON "_article_categories_v" USING btree ("created_at");
  CREATE INDEX "_article_categories_v_updated_at_idx" ON "_article_categories_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_seo_seo_image_idx" ON "tags" USING btree ("seo_image_id");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "tags_deleted_at_idx" ON "tags" USING btree ("deleted_at");
  CREATE INDEX "_tags_v_parent_idx" ON "_tags_v" USING btree ("parent_id");
  CREATE INDEX "_tags_v_version_version_slug_idx" ON "_tags_v" USING btree ("version_slug");
  CREATE INDEX "_tags_v_version_seo_version_seo_image_idx" ON "_tags_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_tags_v_version_version_updated_at_idx" ON "_tags_v" USING btree ("version_updated_at");
  CREATE INDEX "_tags_v_version_version_created_at_idx" ON "_tags_v" USING btree ("version_created_at");
  CREATE INDEX "_tags_v_version_version_deleted_at_idx" ON "_tags_v" USING btree ("version_deleted_at");
  CREATE INDEX "_tags_v_created_at_idx" ON "_tags_v" USING btree ("created_at");
  CREATE INDEX "_tags_v_updated_at_idx" ON "_tags_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "insurances_name_idx" ON "insurances" USING btree ("name");
  CREATE INDEX "insurances_logo_idx" ON "insurances" USING btree ("logo_id");
  CREATE INDEX "insurances_order_idx" ON "insurances" USING btree ("order");
  CREATE INDEX "insurances_updated_at_idx" ON "insurances" USING btree ("updated_at");
  CREATE INDEX "insurances_created_at_idx" ON "insurances" USING btree ("created_at");
  CREATE INDEX "insurances_deleted_at_idx" ON "insurances" USING btree ("deleted_at");
  CREATE INDEX "insurances__status_idx" ON "insurances" USING btree ("_status");
  CREATE INDEX "_insurances_v_parent_idx" ON "_insurances_v" USING btree ("parent_id");
  CREATE INDEX "_insurances_v_version_version_name_idx" ON "_insurances_v" USING btree ("version_name");
  CREATE INDEX "_insurances_v_version_version_logo_idx" ON "_insurances_v" USING btree ("version_logo_id");
  CREATE INDEX "_insurances_v_version_version_order_idx" ON "_insurances_v" USING btree ("version_order");
  CREATE INDEX "_insurances_v_version_version_updated_at_idx" ON "_insurances_v" USING btree ("version_updated_at");
  CREATE INDEX "_insurances_v_version_version_created_at_idx" ON "_insurances_v" USING btree ("version_created_at");
  CREATE INDEX "_insurances_v_version_version_deleted_at_idx" ON "_insurances_v" USING btree ("version_deleted_at");
  CREATE INDEX "_insurances_v_version_version__status_idx" ON "_insurances_v" USING btree ("version__status");
  CREATE INDEX "_insurances_v_created_at_idx" ON "_insurances_v" USING btree ("created_at");
  CREATE INDEX "_insurances_v_updated_at_idx" ON "_insurances_v" USING btree ("updated_at");
  CREATE INDEX "_insurances_v_latest_idx" ON "_insurances_v" USING btree ("latest");
  CREATE UNIQUE INDEX "financing_options_key_idx" ON "financing_options" USING btree ("key");
  CREATE INDEX "financing_options_enabled_idx" ON "financing_options" USING btree ("enabled");
  CREATE INDEX "financing_options_order_idx" ON "financing_options" USING btree ("order");
  CREATE INDEX "financing_options_updated_at_idx" ON "financing_options" USING btree ("updated_at");
  CREATE INDEX "financing_options_created_at_idx" ON "financing_options" USING btree ("created_at");
  CREATE INDEX "financing_options_deleted_at_idx" ON "financing_options" USING btree ("deleted_at");
  CREATE INDEX "financing_options__status_idx" ON "financing_options" USING btree ("_status");
  CREATE INDEX "_financing_options_v_parent_idx" ON "_financing_options_v" USING btree ("parent_id");
  CREATE INDEX "_financing_options_v_version_version_key_idx" ON "_financing_options_v" USING btree ("version_key");
  CREATE INDEX "_financing_options_v_version_version_enabled_idx" ON "_financing_options_v" USING btree ("version_enabled");
  CREATE INDEX "_financing_options_v_version_version_order_idx" ON "_financing_options_v" USING btree ("version_order");
  CREATE INDEX "_financing_options_v_version_version_updated_at_idx" ON "_financing_options_v" USING btree ("version_updated_at");
  CREATE INDEX "_financing_options_v_version_version_created_at_idx" ON "_financing_options_v" USING btree ("version_created_at");
  CREATE INDEX "_financing_options_v_version_version_deleted_at_idx" ON "_financing_options_v" USING btree ("version_deleted_at");
  CREATE INDEX "_financing_options_v_version_version__status_idx" ON "_financing_options_v" USING btree ("version__status");
  CREATE INDEX "_financing_options_v_created_at_idx" ON "_financing_options_v" USING btree ("created_at");
  CREATE INDEX "_financing_options_v_updated_at_idx" ON "_financing_options_v" USING btree ("updated_at");
  CREATE INDEX "_financing_options_v_latest_idx" ON "_financing_options_v" USING btree ("latest");
  CREATE UNIQUE INDEX "media_seed_source_idx" ON "media" USING btree ("seed_source");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE INDEX "media_deleted_at_idx" ON "media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_w640_sizes_w640_filename_idx" ON "media" USING btree ("sizes_w640_filename");
  CREATE INDEX "media_sizes_w640_avif_sizes_w640_avif_filename_idx" ON "media" USING btree ("sizes_w640_avif_filename");
  CREATE INDEX "media_sizes_w960_sizes_w960_filename_idx" ON "media" USING btree ("sizes_w960_filename");
  CREATE INDEX "media_sizes_w960_avif_sizes_w960_avif_filename_idx" ON "media" USING btree ("sizes_w960_avif_filename");
  CREATE INDEX "media_sizes_w1280_sizes_w1280_filename_idx" ON "media" USING btree ("sizes_w1280_filename");
  CREATE INDEX "media_sizes_w1280_avif_sizes_w1280_avif_filename_idx" ON "media" USING btree ("sizes_w1280_avif_filename");
  CREATE INDEX "media_sizes_w1600_sizes_w1600_filename_idx" ON "media" USING btree ("sizes_w1600_filename");
  CREATE INDEX "media_sizes_w1600_avif_sizes_w1600_avif_filename_idx" ON "media" USING btree ("sizes_w1600_avif_filename");
  CREATE INDEX "media_sizes_w1920_sizes_w1920_filename_idx" ON "media" USING btree ("sizes_w1920_filename");
  CREATE INDEX "media_sizes_w1920_avif_sizes_w1920_avif_filename_idx" ON "media" USING btree ("sizes_w1920_avif_filename");
  CREATE INDEX "media_sizes_w2560_sizes_w2560_filename_idx" ON "media" USING btree ("sizes_w2560_filename");
  CREATE INDEX "media_sizes_w2560_avif_sizes_w2560_avif_filename_idx" ON "media" USING btree ("sizes_w2560_avif_filename");
  CREATE INDEX "media_sizes_p640_sizes_p640_filename_idx" ON "media" USING btree ("sizes_p640_filename");
  CREATE INDEX "media_sizes_p640_avif_sizes_p640_avif_filename_idx" ON "media" USING btree ("sizes_p640_avif_filename");
  CREATE INDEX "media_sizes_p828_sizes_p828_filename_idx" ON "media" USING btree ("sizes_p828_filename");
  CREATE INDEX "media_sizes_p828_avif_sizes_p828_avif_filename_idx" ON "media" USING btree ("sizes_p828_avif_filename");
  CREATE INDEX "media_sizes_p1080_sizes_p1080_filename_idx" ON "media" USING btree ("sizes_p1080_filename");
  CREATE INDEX "media_sizes_p1080_avif_sizes_p1080_avif_filename_idx" ON "media" USING btree ("sizes_p1080_avif_filename");
  CREATE INDEX "media_sizes_s640_sizes_s640_filename_idx" ON "media" USING btree ("sizes_s640_filename");
  CREATE INDEX "media_sizes_s640_avif_sizes_s640_avif_filename_idx" ON "media" USING btree ("sizes_s640_avif_filename");
  CREATE INDEX "media_sizes_s1080_sizes_s1080_filename_idx" ON "media" USING btree ("sizes_s1080_filename");
  CREATE INDEX "media_sizes_s1080_avif_sizes_s1080_avif_filename_idx" ON "media" USING btree ("sizes_s1080_avif_filename");
  CREATE INDEX "testimonials_service_idx" ON "testimonials" USING btree ("service_id");
  CREATE INDEX "testimonials_video_idx" ON "testimonials" USING btree ("video_id");
  CREATE INDEX "testimonials_poster_idx" ON "testimonials" USING btree ("poster_id");
  CREATE INDEX "testimonials_order_idx" ON "testimonials" USING btree ("order");
  CREATE UNIQUE INDEX "testimonials_seed_key_idx" ON "testimonials" USING btree ("seed_key");
  CREATE INDEX "testimonials_updated_at_idx" ON "testimonials" USING btree ("updated_at");
  CREATE INDEX "testimonials_created_at_idx" ON "testimonials" USING btree ("created_at");
  CREATE INDEX "testimonials_deleted_at_idx" ON "testimonials" USING btree ("deleted_at");
  CREATE INDEX "testimonials__status_idx" ON "testimonials" USING btree ("_status");
  CREATE INDEX "_testimonials_v_parent_idx" ON "_testimonials_v" USING btree ("parent_id");
  CREATE INDEX "_testimonials_v_version_version_service_idx" ON "_testimonials_v" USING btree ("version_service_id");
  CREATE INDEX "_testimonials_v_version_version_video_idx" ON "_testimonials_v" USING btree ("version_video_id");
  CREATE INDEX "_testimonials_v_version_version_poster_idx" ON "_testimonials_v" USING btree ("version_poster_id");
  CREATE INDEX "_testimonials_v_version_version_order_idx" ON "_testimonials_v" USING btree ("version_order");
  CREATE INDEX "_testimonials_v_version_version_seed_key_idx" ON "_testimonials_v" USING btree ("version_seed_key");
  CREATE INDEX "_testimonials_v_version_version_updated_at_idx" ON "_testimonials_v" USING btree ("version_updated_at");
  CREATE INDEX "_testimonials_v_version_version_created_at_idx" ON "_testimonials_v" USING btree ("version_created_at");
  CREATE INDEX "_testimonials_v_version_version_deleted_at_idx" ON "_testimonials_v" USING btree ("version_deleted_at");
  CREATE INDEX "_testimonials_v_version_version__status_idx" ON "_testimonials_v" USING btree ("version__status");
  CREATE INDEX "_testimonials_v_created_at_idx" ON "_testimonials_v" USING btree ("created_at");
  CREATE INDEX "_testimonials_v_updated_at_idx" ON "_testimonials_v" USING btree ("updated_at");
  CREATE INDEX "_testimonials_v_latest_idx" ON "_testimonials_v" USING btree ("latest");
  CREATE INDEX "cases_service_idx" ON "cases" USING btree ("service_id");
  CREATE INDEX "cases_doctor_idx" ON "cases" USING btree ("doctor_id");
  CREATE INDEX "cases_before_idx" ON "cases" USING btree ("before_id");
  CREATE INDEX "cases_after_idx" ON "cases" USING btree ("after_id");
  CREATE INDEX "cases_order_idx" ON "cases" USING btree ("order");
  CREATE UNIQUE INDEX "cases_source_folder_idx" ON "cases" USING btree ("source_folder");
  CREATE INDEX "cases_updated_at_idx" ON "cases" USING btree ("updated_at");
  CREATE INDEX "cases_created_at_idx" ON "cases" USING btree ("created_at");
  CREATE INDEX "cases_deleted_at_idx" ON "cases" USING btree ("deleted_at");
  CREATE INDEX "cases__status_idx" ON "cases" USING btree ("_status");
  CREATE INDEX "_cases_v_parent_idx" ON "_cases_v" USING btree ("parent_id");
  CREATE INDEX "_cases_v_version_version_service_idx" ON "_cases_v" USING btree ("version_service_id");
  CREATE INDEX "_cases_v_version_version_doctor_idx" ON "_cases_v" USING btree ("version_doctor_id");
  CREATE INDEX "_cases_v_version_version_before_idx" ON "_cases_v" USING btree ("version_before_id");
  CREATE INDEX "_cases_v_version_version_after_idx" ON "_cases_v" USING btree ("version_after_id");
  CREATE INDEX "_cases_v_version_version_order_idx" ON "_cases_v" USING btree ("version_order");
  CREATE INDEX "_cases_v_version_version_source_folder_idx" ON "_cases_v" USING btree ("version_source_folder");
  CREATE INDEX "_cases_v_version_version_updated_at_idx" ON "_cases_v" USING btree ("version_updated_at");
  CREATE INDEX "_cases_v_version_version_created_at_idx" ON "_cases_v" USING btree ("version_created_at");
  CREATE INDEX "_cases_v_version_version_deleted_at_idx" ON "_cases_v" USING btree ("version_deleted_at");
  CREATE INDEX "_cases_v_version_version__status_idx" ON "_cases_v" USING btree ("version__status");
  CREATE INDEX "_cases_v_created_at_idx" ON "_cases_v" USING btree ("created_at");
  CREATE INDEX "_cases_v_updated_at_idx" ON "_cases_v" USING btree ("updated_at");
  CREATE INDEX "_cases_v_latest_idx" ON "_cases_v" USING btree ("latest");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_to_idx" ON "redirects" USING btree ("to");
  CREATE INDEX "redirects_active_idx" ON "redirects" USING btree ("active");
  CREATE INDEX "redirects_source_idx" ON "redirects" USING btree ("source");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "_redirects_v_parent_idx" ON "_redirects_v" USING btree ("parent_id");
  CREATE INDEX "_redirects_v_version_version_from_idx" ON "_redirects_v" USING btree ("version_from");
  CREATE INDEX "_redirects_v_version_version_to_idx" ON "_redirects_v" USING btree ("version_to");
  CREATE INDEX "_redirects_v_version_version_active_idx" ON "_redirects_v" USING btree ("version_active");
  CREATE INDEX "_redirects_v_version_version_source_idx" ON "_redirects_v" USING btree ("version_source");
  CREATE INDEX "_redirects_v_version_version_updated_at_idx" ON "_redirects_v" USING btree ("version_updated_at");
  CREATE INDEX "_redirects_v_version_version_created_at_idx" ON "_redirects_v" USING btree ("version_created_at");
  CREATE INDEX "_redirects_v_created_at_idx" ON "_redirects_v" USING btree ("created_at");
  CREATE INDEX "_redirects_v_updated_at_idx" ON "_redirects_v" USING btree ("updated_at");
  CREATE INDEX "events_daily_date_idx" ON "events_daily" USING btree ("date");
  CREATE INDEX "events_daily_event_idx" ON "events_daily" USING btree ("event");
  CREATE INDEX "events_daily_updated_at_idx" ON "events_daily" USING btree ("updated_at");
  CREATE INDEX "events_daily_created_at_idx" ON "events_daily" USING btree ("created_at");
  CREATE UNIQUE INDEX "date_event_location_pageType_serviceKey_idx" ON "events_daily" USING btree ("date","event","location","page_type","service_key");
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_request_id_idx" ON "audit_log" USING btree ("request_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE INDEX "entitySlug_docId_idx" ON "audit_log" USING btree ("entity_slug","doc_id");
  CREATE INDEX "actor_createdAt_idx" ON "audit_log" USING btree ("actor_id","created_at");
  CREATE INDEX "audit_log_texts_order_parent" ON "audit_log_texts" USING btree ("order","parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_service_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("service_categories_id");
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_service_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("service_tiers_id");
  CREATE INDEX "payload_locked_documents_rels_doctors_id_idx" ON "payload_locked_documents_rels" USING btree ("doctors_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_article_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("article_categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_insurances_id_idx" ON "payload_locked_documents_rels" USING btree ("insurances_id");
  CREATE INDEX "payload_locked_documents_rels_financing_options_id_idx" ON "payload_locked_documents_rels" USING btree ("financing_options_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_testimonials_id_idx" ON "payload_locked_documents_rels" USING btree ("testimonials_id");
  CREATE INDEX "payload_locked_documents_rels_cases_id_idx" ON "payload_locked_documents_rels" USING btree ("cases_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "clinic_hours_weekly_days_order_idx" ON "clinic_hours_weekly_days" USING btree ("order");
  CREATE INDEX "clinic_hours_weekly_days_parent_idx" ON "clinic_hours_weekly_days" USING btree ("parent_id");
  CREATE INDEX "clinic_hours_weekly_order_idx" ON "clinic_hours_weekly" USING btree ("_order");
  CREATE INDEX "clinic_hours_weekly_parent_id_idx" ON "clinic_hours_weekly" USING btree ("_parent_id");
  CREATE INDEX "clinic_hours_holidays_order_idx" ON "clinic_hours_holidays" USING btree ("_order");
  CREATE INDEX "clinic_hours_holidays_parent_id_idx" ON "clinic_hours_holidays" USING btree ("_parent_id");
  CREATE INDEX "clinic_maps_maps_static_map_idx" ON "clinic" USING btree ("maps_static_map_id");
  CREATE INDEX "_clinic_v_version_hours_weekly_days_order_idx" ON "_clinic_v_version_hours_weekly_days" USING btree ("order");
  CREATE INDEX "_clinic_v_version_hours_weekly_days_parent_idx" ON "_clinic_v_version_hours_weekly_days" USING btree ("parent_id");
  CREATE INDEX "_clinic_v_version_hours_weekly_order_idx" ON "_clinic_v_version_hours_weekly" USING btree ("_order");
  CREATE INDEX "_clinic_v_version_hours_weekly_parent_id_idx" ON "_clinic_v_version_hours_weekly" USING btree ("_parent_id");
  CREATE INDEX "_clinic_v_version_hours_holidays_order_idx" ON "_clinic_v_version_hours_holidays" USING btree ("_order");
  CREATE INDEX "_clinic_v_version_hours_holidays_parent_id_idx" ON "_clinic_v_version_hours_holidays" USING btree ("_parent_id");
  CREATE INDEX "_clinic_v_version_maps_version_maps_static_map_idx" ON "_clinic_v" USING btree ("version_maps_static_map_id");
  CREATE INDEX "_clinic_v_created_at_idx" ON "_clinic_v" USING btree ("created_at");
  CREATE INDEX "_clinic_v_updated_at_idx" ON "_clinic_v" USING btree ("updated_at");
  CREATE INDEX "seo_defaults_default_og_image_idx" ON "seo_defaults" USING btree ("default_og_image_id");
  CREATE INDEX "seo_defaults_texts_order_parent" ON "seo_defaults_texts" USING btree ("order","parent_id");
  CREATE INDEX "_seo_defaults_v_version_version_default_og_image_idx" ON "_seo_defaults_v" USING btree ("version_default_og_image_id");
  CREATE INDEX "_seo_defaults_v_created_at_idx" ON "_seo_defaults_v" USING btree ("created_at");
  CREATE INDEX "_seo_defaults_v_updated_at_idx" ON "_seo_defaults_v" USING btree ("updated_at");
  CREATE INDEX "_seo_defaults_v_texts_order_parent" ON "_seo_defaults_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_features_v_created_at_idx" ON "_features_v" USING btree ("created_at");
  CREATE INDEX "_features_v_updated_at_idx" ON "_features_v" USING btree ("updated_at");
  CREATE INDEX "notifier_mail_recipients_order_idx" ON "notifier_mail_recipients" USING btree ("_order");
  CREATE INDEX "notifier_mail_recipients_parent_id_idx" ON "notifier_mail_recipients" USING btree ("_parent_id");
  CREATE INDEX "notifier_sms_admin_recipients_order_idx" ON "notifier_sms_admin_recipients" USING btree ("_order");
  CREATE INDEX "notifier_sms_admin_recipients_parent_id_idx" ON "notifier_sms_admin_recipients" USING btree ("_parent_id");
  CREATE INDEX "_notifier_v_version_mail_recipients_order_idx" ON "_notifier_v_version_mail_recipients" USING btree ("_order");
  CREATE INDEX "_notifier_v_version_mail_recipients_parent_id_idx" ON "_notifier_v_version_mail_recipients" USING btree ("_parent_id");
  CREATE INDEX "_notifier_v_version_sms_admin_recipients_order_idx" ON "_notifier_v_version_sms_admin_recipients" USING btree ("_order");
  CREATE INDEX "_notifier_v_version_sms_admin_recipients_parent_id_idx" ON "_notifier_v_version_sms_admin_recipients" USING btree ("_parent_id");
  CREATE INDEX "_notifier_v_created_at_idx" ON "_notifier_v" USING btree ("created_at");
  CREATE INDEX "_notifier_v_updated_at_idx" ON "_notifier_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "bookings_triage" CASCADE;
  DROP TABLE "bookings_flags" CASCADE;
  DROP TABLE "bookings_admin_notes" CASCADE;
  DROP TABLE "bookings_duplicate_submissions" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "pages_blocks_content" CASCADE;
  DROP TABLE "pages_blocks_faq_items" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages_blocks_facts_items" CASCADE;
  DROP TABLE "pages_blocks_facts" CASCADE;
  DROP TABLE "pages_blocks_callout" CASCADE;
  DROP TABLE "pages_sources" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_blocks_content" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "_pages_v_blocks_faq" CASCADE;
  DROP TABLE "_pages_v_blocks_facts_items" CASCADE;
  DROP TABLE "_pages_v_blocks_facts" CASCADE;
  DROP TABLE "_pages_v_blocks_callout" CASCADE;
  DROP TABLE "_pages_v_version_sources" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "service_categories" CASCADE;
  DROP TABLE "_service_categories_v" CASCADE;
  DROP TABLE "services_blocks_content" CASCADE;
  DROP TABLE "services_blocks_steps_items" CASCADE;
  DROP TABLE "services_blocks_steps" CASCADE;
  DROP TABLE "services_blocks_callout" CASCADE;
  DROP TABLE "services_faqs" CASCADE;
  DROP TABLE "services_sources" CASCADE;
  DROP TABLE "services" CASCADE;
  DROP TABLE "services_texts" CASCADE;
  DROP TABLE "services_rels" CASCADE;
  DROP TABLE "_services_v_blocks_content" CASCADE;
  DROP TABLE "_services_v_blocks_steps_items" CASCADE;
  DROP TABLE "_services_v_blocks_steps" CASCADE;
  DROP TABLE "_services_v_blocks_callout" CASCADE;
  DROP TABLE "_services_v_version_faqs" CASCADE;
  DROP TABLE "_services_v_version_sources" CASCADE;
  DROP TABLE "_services_v" CASCADE;
  DROP TABLE "_services_v_texts" CASCADE;
  DROP TABLE "_services_v_rels" CASCADE;
  DROP TABLE "service_tiers" CASCADE;
  DROP TABLE "service_tiers_texts" CASCADE;
  DROP TABLE "_service_tiers_v" CASCADE;
  DROP TABLE "_service_tiers_v_texts" CASCADE;
  DROP TABLE "doctors" CASCADE;
  DROP TABLE "doctors_texts" CASCADE;
  DROP TABLE "doctors_rels" CASCADE;
  DROP TABLE "_doctors_v" CASCADE;
  DROP TABLE "_doctors_v_texts" CASCADE;
  DROP TABLE "_doctors_v_rels" CASCADE;
  DROP TABLE "articles_sources" CASCADE;
  DROP TABLE "articles_faqs" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v_version_sources" CASCADE;
  DROP TABLE "_articles_v_version_faqs" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "article_categories" CASCADE;
  DROP TABLE "_article_categories_v" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "_tags_v" CASCADE;
  DROP TABLE "insurances" CASCADE;
  DROP TABLE "_insurances_v" CASCADE;
  DROP TABLE "financing_options" CASCADE;
  DROP TABLE "_financing_options_v" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "testimonials" CASCADE;
  DROP TABLE "_testimonials_v" CASCADE;
  DROP TABLE "cases" CASCADE;
  DROP TABLE "_cases_v" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "_redirects_v" CASCADE;
  DROP TABLE "events_daily" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "audit_log_texts" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "totp_attempts" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "clinic_hours_weekly_days" CASCADE;
  DROP TABLE "clinic_hours_weekly" CASCADE;
  DROP TABLE "clinic_hours_holidays" CASCADE;
  DROP TABLE "clinic" CASCADE;
  DROP TABLE "_clinic_v_version_hours_weekly_days" CASCADE;
  DROP TABLE "_clinic_v_version_hours_weekly" CASCADE;
  DROP TABLE "_clinic_v_version_hours_holidays" CASCADE;
  DROP TABLE "_clinic_v" CASCADE;
  DROP TABLE "seo_defaults" CASCADE;
  DROP TABLE "seo_defaults_texts" CASCADE;
  DROP TABLE "_seo_defaults_v" CASCADE;
  DROP TABLE "_seo_defaults_v_texts" CASCADE;
  DROP TABLE "features" CASCADE;
  DROP TABLE "_features_v" CASCADE;
  DROP TABLE "notifier_mail_recipients" CASCADE;
  DROP TABLE "notifier_sms_admin_recipients" CASCADE;
  DROP TABLE "notifier" CASCADE;
  DROP TABLE "_notifier_v_version_mail_recipients" CASCADE;
  DROP TABLE "_notifier_v_version_sms_admin_recipients" CASCADE;
  DROP TABLE "_notifier_v" CASCADE;
  DROP TABLE "system_state" CASCADE;
  DROP TYPE "public"."enum_bookings_triage";
  DROP TYPE "public"."enum_bookings_flags";
  DROP TYPE "public"."enum_bookings_kind";
  DROP TYPE "public"."enum_bookings_booking_group";
  DROP TYPE "public"."enum_bookings_preferred_time";
  DROP TYPE "public"."enum_bookings_emergency_outcome";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_bookings_form_location";
  DROP TYPE "public"."enum_bookings_heard_from";
  DROP TYPE "public"."enum_bookings_device";
  DROP TYPE "public"."enum_pages_blocks_callout_tone";
  DROP TYPE "public"."enum_pages_sources_publisher";
  DROP TYPE "public"."enum_pages_sources_accessedon_tz";
  DROP TYPE "public"."enum_pages_key";
  DROP TYPE "public"."enum_pages_reviewedat_tz";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_callout_tone";
  DROP TYPE "public"."enum__pages_v_version_sources_publisher";
  DROP TYPE "public"."enum__pages_v_version_sources_accessedon_tz";
  DROP TYPE "public"."enum__pages_v_version_key";
  DROP TYPE "public"."enum__pages_v_version_reviewedat_tz";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_service_categories_accent";
  DROP TYPE "public"."enum_service_categories_status";
  DROP TYPE "public"."enum__service_categories_v_version_accent";
  DROP TYPE "public"."enum__service_categories_v_version_status";
  DROP TYPE "public"."enum_services_blocks_callout_tone";
  DROP TYPE "public"."enum_services_sources_publisher";
  DROP TYPE "public"."enum_services_sources_accessedon_tz";
  DROP TYPE "public"."enum_services_booking_group";
  DROP TYPE "public"."enum_services_reviewedat_tz";
  DROP TYPE "public"."enum_services_status";
  DROP TYPE "public"."enum__services_v_blocks_callout_tone";
  DROP TYPE "public"."enum__services_v_version_sources_publisher";
  DROP TYPE "public"."enum__services_v_version_sources_accessedon_tz";
  DROP TYPE "public"."enum__services_v_version_booking_group";
  DROP TYPE "public"."enum__services_v_version_reviewedat_tz";
  DROP TYPE "public"."enum__services_v_version_status";
  DROP TYPE "public"."enum_service_tiers_status";
  DROP TYPE "public"."enum__service_tiers_v_version_status";
  DROP TYPE "public"."enum_doctors_status";
  DROP TYPE "public"."enum__doctors_v_version_status";
  DROP TYPE "public"."enum_articles_sources_publisher";
  DROP TYPE "public"."enum_articles_sources_accessedon_tz";
  DROP TYPE "public"."enum_articles_reviewedat_tz";
  DROP TYPE "public"."enum_articles_review_state";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_version_sources_publisher";
  DROP TYPE "public"."enum__articles_v_version_sources_accessedon_tz";
  DROP TYPE "public"."enum__articles_v_version_reviewedat_tz";
  DROP TYPE "public"."enum__articles_v_version_review_state";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum_insurances_status";
  DROP TYPE "public"."enum__insurances_v_version_status";
  DROP TYPE "public"."enum_financing_options_approval_status";
  DROP TYPE "public"."enum_financing_options_approvedon_tz";
  DROP TYPE "public"."enum_financing_options_status";
  DROP TYPE "public"."enum__financing_options_v_version_approval_status";
  DROP TYPE "public"."enum__financing_options_v_version_approvedon_tz";
  DROP TYPE "public"."enum__financing_options_v_version_status";
  DROP TYPE "public"."enum_testimonials_type";
  DROP TYPE "public"."enum_testimonials_recordedat_tz";
  DROP TYPE "public"."enum_testimonials_status";
  DROP TYPE "public"."enum__testimonials_v_version_type";
  DROP TYPE "public"."enum__testimonials_v_version_recordedat_tz";
  DROP TYPE "public"."enum__testimonials_v_version_status";
  DROP TYPE "public"."enum_cases_status";
  DROP TYPE "public"."enum__cases_v_version_status";
  DROP TYPE "public"."enum_redirects_status_code";
  DROP TYPE "public"."enum_redirects_source";
  DROP TYPE "public"."enum__redirects_v_version_status_code";
  DROP TYPE "public"."enum__redirects_v_version_source";
  DROP TYPE "public"."enum_audit_log_action";
  DROP TYPE "public"."enum_audit_log_entity_type";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_clinic_hours_weekly_days";
  DROP TYPE "public"."enum__clinic_v_version_hours_weekly_days";
  DROP TYPE "public"."enum_features_quality_tier_override";
  DROP TYPE "public"."enum__features_v_version_quality_tier_override";`)
}
