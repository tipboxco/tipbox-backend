-- AlterTable
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "category_id" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "brand_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("id")
);

-- Add slug column if it doesn't exist (table may have been created without it)
ALTER TABLE "brand_categories" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "brand_categories" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Make slug NOT NULL if it's NULL (set a default value first)
UPDATE "brand_categories" SET "slug" = LOWER(REPLACE("name", ' ', '-')) WHERE "slug" IS NULL;
ALTER TABLE "brand_categories" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "brand_categories_slug_key" ON "brand_categories"("slug");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_category_id_fkey'
  ) THEN
    ALTER TABLE "brands" ADD CONSTRAINT "brands_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
