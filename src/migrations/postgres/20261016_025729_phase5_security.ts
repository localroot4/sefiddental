import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_audit_log_action" ADD VALUE 'export';
  ALTER TABLE "bookings_duplicate_submissions" ADD COLUMN "sid_hash" varchar;
  ALTER TABLE "bookings" ADD COLUMN "appends_dropped" numeric DEFAULT 0;
  ALTER TABLE "bookings" ADD COLUMN "sid_hash" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_log_action";
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'update', 'publish', 'unpublish', 'trash', 'restore', 'delete', 'login', 'logout', 'forgot_password', 'seed');
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
  ALTER TABLE "bookings_duplicate_submissions" DROP COLUMN "sid_hash";
  ALTER TABLE "bookings" DROP COLUMN "appends_dropped";
  ALTER TABLE "bookings" DROP COLUMN "sid_hash";`)
}
