import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260112153416 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brand_category" add column if not exists "thumbnail" text null;`);
    this.addSql(`alter table if exists "brand_category" rename column "name" to "title";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand_category" drop column if exists "thumbnail";`);

    this.addSql(`alter table if exists "brand_category" rename column "title" to "name";`);
  }

}
