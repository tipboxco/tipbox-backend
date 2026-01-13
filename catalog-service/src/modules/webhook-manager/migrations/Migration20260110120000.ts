import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260110120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "webhook_config" (
        "id" TEXT NOT NULL,
        "event_name" TEXT NOT NULL,
        "target_url" TEXT NOT NULL,
        "secret_token" TEXT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "webhook_config_pkey" PRIMARY KEY ("id")
      );
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_config_event_name" 
      ON "webhook_config" ("event_name");
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_config_is_active" 
      ON "webhook_config" ("is_active") 
      WHERE "is_active" = true;
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_config_deleted_at" 
      ON "webhook_config" ("deleted_at") 
      WHERE "deleted_at" IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "webhook_config" CASCADE;`)
  }
}

