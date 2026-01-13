import { Migration } from "@mikro-orm/migrations"

export class Migration20260110180000 extends Migration {
  async up(): Promise<void> {
    // sync_config tablosu
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "sync_config" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "module_type" TEXT NOT NULL CHECK ("module_type" IN ('product', 'category', 'brand')),
        "target_url" TEXT NOT NULL,
        "secret_token" TEXT NULL,
        "batch_size" INTEGER NOT NULL DEFAULT 1000,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "last_sync_at" TIMESTAMPTZ NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "sync_config_pkey" PRIMARY KEY ("id")
      );
    `)

    // sync_job tablosu
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "sync_job" (
        "id" TEXT NOT NULL,
        "sync_config_id" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        "total_records" INTEGER NOT NULL DEFAULT 0,
        "processed_records" INTEGER NOT NULL DEFAULT 0,
        "failed_records" INTEGER NOT NULL DEFAULT 0,
        "current_batch" INTEGER NOT NULL DEFAULT 0,
        "total_batches" INTEGER NOT NULL DEFAULT 0,
        "started_at" TIMESTAMPTZ NULL,
        "completed_at" TIMESTAMPTZ NULL,
        "error_message" TEXT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "sync_job_pkey" PRIMARY KEY ("id")
      );
    `)

    // İndeksler
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_config_module_type" ON "sync_config" ("module_type");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_config_is_active" ON "sync_config" ("is_active");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_config_deleted_at" ON "sync_config" ("deleted_at") WHERE deleted_at IS NULL;`)
    
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_job_sync_config_id" ON "sync_job" ("sync_config_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_job_status" ON "sync_job" ("status");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sync_job_deleted_at" ON "sync_job" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "sync_job" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "sync_config" CASCADE;`)
  }
}

