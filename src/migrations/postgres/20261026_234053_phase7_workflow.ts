import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_pages_sections_key" ADD VALUE 'workflow' BEFORE 'compare';
  ALTER TYPE "public"."enum__pages_v_version_sections_key" ADD VALUE 'workflow' BEFORE 'compare';
  CREATE TABLE "pages_blocks_workflow_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"photo_id" integer
  );
  
  CREATE TABLE "pages_blocks_workflow" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_workflow_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"photo_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_workflow" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_workflow_items" ADD CONSTRAINT "pages_blocks_workflow_items_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_workflow_items" ADD CONSTRAINT "pages_blocks_workflow_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_workflow"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_workflow" ADD CONSTRAINT "pages_blocks_workflow_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_workflow_items" ADD CONSTRAINT "_pages_v_blocks_workflow_items_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_workflow_items" ADD CONSTRAINT "_pages_v_blocks_workflow_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_workflow"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_workflow" ADD CONSTRAINT "_pages_v_blocks_workflow_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_workflow_items_order_idx" ON "pages_blocks_workflow_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_workflow_items_parent_id_idx" ON "pages_blocks_workflow_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_workflow_items_photo_idx" ON "pages_blocks_workflow_items" USING btree ("photo_id");
  CREATE INDEX "pages_blocks_workflow_order_idx" ON "pages_blocks_workflow" USING btree ("_order");
  CREATE INDEX "pages_blocks_workflow_parent_id_idx" ON "pages_blocks_workflow" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_workflow_path_idx" ON "pages_blocks_workflow" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_workflow_items_order_idx" ON "_pages_v_blocks_workflow_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_workflow_items_parent_id_idx" ON "_pages_v_blocks_workflow_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_workflow_items_photo_idx" ON "_pages_v_blocks_workflow_items" USING btree ("photo_id");
  CREATE INDEX "_pages_v_blocks_workflow_order_idx" ON "_pages_v_blocks_workflow" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_workflow_parent_id_idx" ON "_pages_v_blocks_workflow" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_workflow_path_idx" ON "_pages_v_blocks_workflow" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_workflow_items" CASCADE;
  DROP TABLE "pages_blocks_workflow" CASCADE;
  DROP TABLE "_pages_v_blocks_workflow_items" CASCADE;
  DROP TABLE "_pages_v_blocks_workflow" CASCADE;
  ALTER TABLE "pages_sections" ALTER COLUMN "key" SET DATA TYPE text;
  DROP TYPE "public"."enum_pages_sections_key";
  CREATE TYPE "public"."enum_pages_sections_key" AS ENUM('services', 'restoration', 'compare', 'dentists', 'voices', 'journey', 'faq', 'booking');
  ALTER TABLE "pages_sections" ALTER COLUMN "key" SET DATA TYPE "public"."enum_pages_sections_key" USING "key"::"public"."enum_pages_sections_key";
  ALTER TABLE "_pages_v_version_sections" ALTER COLUMN "key" SET DATA TYPE text;
  DROP TYPE "public"."enum__pages_v_version_sections_key";
  CREATE TYPE "public"."enum__pages_v_version_sections_key" AS ENUM('services', 'restoration', 'compare', 'dentists', 'voices', 'journey', 'faq', 'booking');
  ALTER TABLE "_pages_v_version_sections" ALTER COLUMN "key" SET DATA TYPE "public"."enum__pages_v_version_sections_key" USING "key"::"public"."enum__pages_v_version_sections_key";`)
}
