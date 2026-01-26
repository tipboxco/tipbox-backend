import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260122143818 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "brand" add column if not exists "rank" integer null, add column if not exists "ispopular" boolean null, add column if not exists "tags" jsonb null, add column if not exists "banner_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand" drop column if exists "rank", drop column if exists "ispopular", drop column if exists "tags", drop column if exists "banner_url";`);
  }

}
