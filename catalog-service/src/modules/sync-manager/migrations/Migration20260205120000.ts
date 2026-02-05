import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * sync_config.module_type enum'una 'backend_seed' ekler.
 * Backend (Tipbox) seed çalıştırma işleri için aynı sync/job tabloları kullanılır.
 */
export class Migration20260205120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "sync_config"
      DROP CONSTRAINT IF EXISTS "sync_config_module_type_check";
    `)
    this.addSql(`
      ALTER TABLE "sync_config"
      ADD CONSTRAINT "sync_config_module_type_check"
      CHECK ("module_type" IN ('product', 'category', 'brand', 'brand_category', 'backend_seed'));
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "sync_config"
      DROP CONSTRAINT IF EXISTS "sync_config_module_type_check";
    `)
    this.addSql(`
      ALTER TABLE "sync_config"
      ADD CONSTRAINT "sync_config_module_type_check"
      CHECK ("module_type" IN ('product', 'category', 'brand', 'brand_category'));
    `)
  }
}
