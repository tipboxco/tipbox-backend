/*
  Warnings:

  - You are about to drop the column `ai_split_id` on the `content_posts` table. All the data in the column will be lost.
  - You are about to drop the column `ai_split_id` on the `inventories` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_ai_split_id_fkey";

-- DropForeignKey
ALTER TABLE "inventories" DROP CONSTRAINT "inventories_ai_split_id_fkey";

-- DropIndex
DROP INDEX "content_posts_ai_split_id_idx";

-- DropIndex
DROP INDEX "inventories_ai_split_id_idx";

-- AlterTable
ALTER TABLE "ai_experience_splits" ADD COLUMN     "price_and_shopping_is_enhanced" BOOLEAN,
ADD COLUMN     "price_and_shopping_placeholder" TEXT,
ADD COLUMN     "product_and_usage_is_enhanced" BOOLEAN,
ADD COLUMN     "product_and_usage_placeholder" TEXT,
ALTER COLUMN "prompt_version" SET DEFAULT 'v2.1';

-- AlterTable
ALTER TABLE "content_posts" DROP COLUMN "ai_split_id",
ADD COLUMN     "experience_duration_id" UUID,
ADD COLUMN     "experience_location_id" UUID,
ADD COLUMN     "experience_purpose_id" UUID,
ADD COLUMN     "experience_snippet_id" UUID;

-- AlterTable
ALTER TABLE "inventories" DROP COLUMN "ai_split_id",
ADD COLUMN     "experience_duration_id" UUID,
ADD COLUMN     "experience_location_id" UUID,
ADD COLUMN     "experience_purpose_id" UUID,
ADD COLUMN     "experience_snippet_id" UUID;

-- CreateIndex
CREATE INDEX "content_posts_experience_snippet_id_idx" ON "content_posts"("experience_snippet_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_duration_id_idx" ON "content_posts"("experience_duration_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_location_id_idx" ON "content_posts"("experience_location_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_purpose_id_idx" ON "content_posts"("experience_purpose_id");

-- CreateIndex
CREATE INDEX "inventories_experience_snippet_id_idx" ON "inventories"("experience_snippet_id");

-- CreateIndex
CREATE INDEX "inventories_experience_duration_id_idx" ON "inventories"("experience_duration_id");

-- CreateIndex
CREATE INDEX "inventories_experience_location_id_idx" ON "inventories"("experience_location_id");

-- CreateIndex
CREATE INDEX "inventories_experience_purpose_id_idx" ON "inventories"("experience_purpose_id");

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_snippet_id_fkey" FOREIGN KEY ("experience_snippet_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_duration_id_fkey" FOREIGN KEY ("experience_duration_id") REFERENCES "experience_durations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_location_id_fkey" FOREIGN KEY ("experience_location_id") REFERENCES "experience_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_purpose_id_fkey" FOREIGN KEY ("experience_purpose_id") REFERENCES "experience_purposes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_snippet_id_fkey" FOREIGN KEY ("experience_snippet_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_duration_id_fkey" FOREIGN KEY ("experience_duration_id") REFERENCES "experience_durations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_location_id_fkey" FOREIGN KEY ("experience_location_id") REFERENCES "experience_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_purpose_id_fkey" FOREIGN KEY ("experience_purpose_id") REFERENCES "experience_purposes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
