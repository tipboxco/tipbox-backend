-- Add new enum values to FeedSource
ALTER TYPE "feed_source" ADD VALUE IF NOT EXISTS 'TRUSTER_NETWORK';
ALTER TYPE "feed_source" ADD VALUE IF NOT EXISTS 'MUTUAL_TRUST';
ALTER TYPE "feed_source" ADD VALUE IF NOT EXISTS 'INVENTORY_MATCH';
ALTER TYPE "feed_source" ADD VALUE IF NOT EXISTS 'PRODUCT_GROUP_MATCH';
ALTER TYPE "feed_source" ADD VALUE IF NOT EXISTS 'ENGAGEMENT_HIGH';

-- Add relevance_score column to feeds table
ALTER TABLE "feeds" 
ADD COLUMN "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN "feeds"."relevance_score" IS 'Relevance score for feed item ranking (0-110). Updated on post creation and user interactions.';

-- Create performance indexes
CREATE INDEX "feeds_user_id_relevance_score_idx" 
ON "feeds"("user_id", "relevance_score" DESC);

CREATE INDEX "feeds_relevance_score_created_at_idx" 
ON "feeds"("relevance_score" DESC, "created_at" DESC);

CREATE INDEX "feeds_user_id_relevance_score_created_at_idx" 
ON "feeds"("user_id", "relevance_score" DESC, "created_at" DESC);

