import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260119210133 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brand" add column if not exists "website_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand" drop column if exists "website_url";`);
  }

}
