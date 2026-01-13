import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260107150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "brand" add column "logo_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "brand" drop column "logo_url";`);
  }

}

