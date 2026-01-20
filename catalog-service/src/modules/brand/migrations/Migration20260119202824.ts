import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260119202824 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brand_category" add column if not exists "handle" text null;`);

    this.addSql(`alter table if exists "brand" add column if not exists "handle" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand_category" drop column if exists "handle";`);

    this.addSql(`alter table if exists "brand" drop column if exists "handle";`);
  }

}
