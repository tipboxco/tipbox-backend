import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260110140000 extends Migration {
  override async up(): Promise<void> {
    // event_name sütununu event_names olarak yeniden adlandır ve JSONB'ye dönüştür
    this.addSql(`
      ALTER TABLE "webhook_config" 
      ADD COLUMN IF NOT EXISTS "event_names" JSONB DEFAULT '[]'::jsonb;
    `)

    // Mevcut event_name verilerini event_names array'ine taşı
    this.addSql(`
      UPDATE "webhook_config" 
      SET "event_names" = CASE 
        WHEN "event_name" IS NOT NULL AND "event_name" != '' 
        THEN jsonb_build_array("event_name")
        ELSE '[]'::jsonb
      END
      WHERE "event_names" = '[]'::jsonb OR "event_names" IS NULL;
    `)

    // Eski event_name sütununu kaldır
    this.addSql(`
      ALTER TABLE "webhook_config" 
      DROP COLUMN IF EXISTS "event_name";
    `)

    // event_names için index oluştur (GIN index for JSONB array)
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_config_event_names" 
      ON "webhook_config" USING GIN ("event_names");
    `)
  }

  override async down(): Promise<void> {
    // event_name sütununu geri ekle
    this.addSql(`
      ALTER TABLE "webhook_config" 
      ADD COLUMN IF NOT EXISTS "event_name" TEXT;
    `)

    // event_names'den ilk elementi event_name'e taşı
    this.addSql(`
      UPDATE "webhook_config" 
      SET "event_name" = "event_names"->>0
      WHERE "event_names" IS NOT NULL AND jsonb_array_length("event_names") > 0;
    `)

    // Index'i kaldır
    this.addSql(`
      DROP INDEX IF EXISTS "IDX_webhook_config_event_names";
    `)

    // event_names sütununu kaldır
    this.addSql(`
      ALTER TABLE "webhook_config" 
      DROP COLUMN IF EXISTS "event_names";
    `)
  }
}

