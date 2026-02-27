-- Add category_id to brand_categories to link to Medusa Category (pcat_...) for display/consistency
ALTER TABLE "brand_categories" ADD COLUMN "category_id" TEXT;

-- FK to categories (Medusa)
ALTER TABLE "brand_categories" ADD CONSTRAINT "brand_categories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "brand_categories_category_id_idx" ON "brand_categories"("category_id");
