import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260112160000 extends Migration {
  override async up(): Promise<void> {
    // sync_config tablosundaki module_type enum'una 'brand_category' ekle
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

  override async down(): Promise<void> {
    // Geri al: brand_category'yi kaldır
    this.addSql(`
      ALTER TABLE "sync_config" 
      DROP CONSTRAINT IF EXISTS "sync_config_module_type_check";
    `)
    
    this.addSql(`
      ALTER TABLE "sync_config" 
      ADD CONSTRAINT "sync_config_module_type_check" 
      CHECK ("module_type" IN ('product', 'category', 'brand'));
    `)
  }
}

