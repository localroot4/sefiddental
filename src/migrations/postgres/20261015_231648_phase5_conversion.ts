import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bookings_duplicate_submissions_triage" AS ENUM('severe_pain', 'swelling', 'broken', 'avulsion', 'bleeding');
  ALTER TYPE "public"."enum_bookings_flags" ADD VALUE 'bad_token' BEFORE 'ip_rate';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'notify' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'notify' BEFORE 'schedulePublish';
  CREATE TABLE "bookings_duplicate_submissions_triage" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_bookings_duplicate_submissions_triage",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "sms_throttle" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"destination_hash" varchar NOT NULL,
  	"last_sent_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "bookings_duplicate_submissions" ADD COLUMN "ip_hash" varchar;
  ALTER TABLE "bookings_duplicate_submissions_triage" ADD CONSTRAINT "bookings_duplicate_submissions_triage_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings_duplicate_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bookings_duplicate_submissions_triage_order_idx" ON "bookings_duplicate_submissions_triage" USING btree ("order");
  CREATE INDEX "bookings_duplicate_submissions_triage_parent_idx" ON "bookings_duplicate_submissions_triage" USING btree ("parent_id");
  CREATE UNIQUE INDEX "sms_throttle_destination_hash_idx" ON "sms_throttle" USING btree ("destination_hash");
  CREATE INDEX "sms_throttle_updated_at_idx" ON "sms_throttle" USING btree ("updated_at");
  CREATE INDEX "sms_throttle_created_at_idx" ON "sms_throttle" USING btree ("created_at");
  CREATE INDEX "bookings_duplicate_submissions_ip_hash_idx" ON "bookings_duplicate_submissions" USING btree ("ip_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings_duplicate_submissions_triage" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sms_throttle" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bookings_duplicate_submissions_triage" CASCADE;
  DROP TABLE "sms_throttle" CASCADE;
  ALTER TABLE "bookings_flags" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_bookings_flags";
  CREATE TYPE "public"."enum_bookings_flags" AS ENUM('honeypot', 'too_fast', 'ip_rate', 'emergency_ip_rate', 'restored', 'emergency_priority_removed', 'manual');
  ALTER TABLE "bookings_flags" ALTER COLUMN "value" SET DATA TYPE "public"."enum_bookings_flags" USING "value"::"public"."enum_bookings_flags";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "bookings_duplicate_submissions_ip_hash_idx";
  ALTER TABLE "bookings_duplicate_submissions" DROP COLUMN "ip_hash";
  DROP TYPE "public"."enum_bookings_duplicate_submissions_triage";`)
}
