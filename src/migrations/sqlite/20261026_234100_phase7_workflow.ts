import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_blocks_workflow_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	\`photo_id\` integer,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_workflow\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_items_order_idx\` ON \`pages_blocks_workflow_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_items_parent_id_idx\` ON \`pages_blocks_workflow_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_items_photo_idx\` ON \`pages_blocks_workflow_items\` (\`photo_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_workflow\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_order_idx\` ON \`pages_blocks_workflow\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_parent_id_idx\` ON \`pages_blocks_workflow\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_workflow_path_idx\` ON \`pages_blocks_workflow\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_workflow_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`text\` text,
  	\`photo_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_workflow\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_items_order_idx\` ON \`_pages_v_blocks_workflow_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_items_parent_id_idx\` ON \`_pages_v_blocks_workflow_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_items_photo_idx\` ON \`_pages_v_blocks_workflow_items\` (\`photo_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_workflow\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_order_idx\` ON \`_pages_v_blocks_workflow\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_parent_id_idx\` ON \`_pages_v_blocks_workflow\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_workflow_path_idx\` ON \`_pages_v_blocks_workflow\` (\`_path\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_blocks_workflow_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_workflow\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_workflow_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_workflow\`;`)
}
