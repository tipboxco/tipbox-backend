-- CreateEnum
CREATE TYPE "wishbox_event_type" AS ENUM ('SURVEY', 'POLL', 'CONTEST', 'CHALLENGE', 'PROMOTION');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "category_id" UUID;

-- AlterTable
ALTER TABLE "wishbox_events" ADD COLUMN     "event_type" "wishbox_event_type" NOT NULL DEFAULT 'SURVEY',
ADD COLUMN     "image_url" TEXT;

-- CreateTable
CREATE TABLE "brand_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_categories_name_key" ON "brand_categories"("name");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
