-- AlterTable: Add choice_product_id (author's selected winner) to post_comparisons
ALTER TABLE "post_comparisons"
  ADD COLUMN IF NOT EXISTS "choice_product_id" TEXT;
