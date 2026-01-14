-- AlterTable
-- Add view_count field to nfts table
ALTER TABLE "nfts" 
ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- Create index for performance
CREATE INDEX "nfts_view_count_idx" ON "nfts"("view_count");

-- Optional: Update existing NFTs view_count based on transaction history
-- This is a one-time migration to set initial view counts
UPDATE "nfts" 
SET "view_count" = (
  SELECT COUNT(*) 
  FROM "nft_transactions" 
  WHERE "nft_transactions"."nft_id" = "nfts"."id"
)
WHERE EXISTS (
  SELECT 1 
  FROM "nft_transactions" 
  WHERE "nft_transactions"."nft_id" = "nfts"."id"
);
