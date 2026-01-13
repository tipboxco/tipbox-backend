-- CreateEnum (already created in previous migration)
-- CREATE TYPE "wishbox_event_type" AS ENUM ('SURVEY', 'POLL', 'CONTEST', 'CHALLENGE', 'PROMOTION');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "category_id" UUID;

-- AlterTable
ALTER TABLE "wishbox_events" 
ADD COLUMN IF NOT EXISTS "event_type" "wishbox_event_type" NOT NULL DEFAULT 'SURVEY',
ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "brand_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "brand_categories_name_key" ON "brand_categories"("name");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_category_id_fkey'
  ) THEN
    ALTER TABLE "brands" ADD CONSTRAINT "brands_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
