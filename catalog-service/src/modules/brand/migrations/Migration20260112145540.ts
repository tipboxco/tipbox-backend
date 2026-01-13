import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260112145540 extends Migration {

  override async up(): Promise<void> {
    
    this.addSql(`alter table if exists "brand" drop constraint if exists "brand_category_id_foreign";`);

    this.addSql(`create table if not exists "brand_category" ("id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brand_category_deleted_at" ON "brand_category" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`drop table if exists "brand_category_items" cascade;`);

    this.addSql(`alter table if exists "brand" drop constraint if exists "brand_category_id_foreign";`);

    this.addSql(`alter table if exists "brand" add column if not exists "category_id" text null;`);
    this.addSql(`alter table if exists "brand" add constraint "brand_category_id_foreign" foreign key ("category_id") references "brand_category" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand" drop constraint if exists "brand_category_id_foreign";`);

    this.addSql(`create table if not exists "brand_category_items" ("id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_category_items_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brand_category_items_deleted_at" ON "brand_category_items" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`drop table if exists "brand_category" cascade;`);

    this.addSql(`alter table if exists "brand" drop constraint if exists "brand_category_id_foreign";`);

    this.addSql(`alter table if exists "brand" add constraint "brand_category_id_foreign" foreign key ("category_id") references "brand_category_items" ("id") on update cascade on delete set null;`);
  }

}
