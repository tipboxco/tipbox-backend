-- AlterTable
-- Stores which product the user picked as their choice/winner in a benchmark comparison.
-- Nullable: legacy comparisons (created before this column) and "no choice" cases stay NULL.
ALTER TABLE "post_comparisons" ADD COLUMN "choice_product_id" TEXT;
