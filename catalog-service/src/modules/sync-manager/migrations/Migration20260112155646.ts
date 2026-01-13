import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260112155646 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "sync_config" ("id" text not null, "name" text not null, "module_type" text check ("module_type" in ('product', 'category', 'brand', 'brand_category')) not null, "target_url" text not null, "secret_token" text null, "batch_size" integer not null default 1000, "is_active" boolean not null default true, "last_sync_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sync_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_config_deleted_at" ON "sync_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "sync_job" ("id" text not null, "sync_config_id" text not null, "status" text check ("status" in ('pending', 'running', 'completed', 'failed', 'cancelled')) not null default 'pending', "total_records" integer not null default 0, "processed_records" integer not null default 0, "failed_records" integer not null default 0, "current_batch" integer not null default 0, "total_batches" integer not null default 0, "started_at" timestamptz null, "completed_at" timestamptz null, "error_message" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sync_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_job_sync_config_id" ON "sync_job" ("sync_config_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_job_deleted_at" ON "sync_job" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sync_config" cascade;`);

    this.addSql(`drop table if exists "sync_job" cascade;`);
  }

}
