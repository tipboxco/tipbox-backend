import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260110160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "webhook_log" (
        "id" TEXT NOT NULL,
        "webhook_id" TEXT NOT NULL,
        "event_name" TEXT NOT NULL,
        "target_url" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "status_code" INTEGER NULL,
        "request_body" JSONB NULL,
        "response_body" TEXT NULL,
        "error_message" TEXT NULL,
        "duration_ms" INTEGER NULL,
        "triggered_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "webhook_log_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "webhook_log_status_check" CHECK ("status" IN ('success', 'failed', 'pending'))
      );
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_log_webhook_id" 
      ON "webhook_log" ("webhook_id");
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_log_triggered_at" 
      ON "webhook_log" ("triggered_at" DESC);
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_log_status" 
      ON "webhook_log" ("status");
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_log_deleted_at" 
      ON "webhook_log" ("deleted_at") 
      WHERE "deleted_at" IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "webhook_log" CASCADE;`)
  }
}

