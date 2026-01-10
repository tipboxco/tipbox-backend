/*
  Warnings:

  - The `context` column on the `dm_messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DMMessageContext" AS ENUM ('DM', 'SUPPORT');

-- CreateEnum
CREATE TYPE "support_type" AS ENUM ('GENERAL', 'TECHNICAL', 'PRODUCT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "content_post_type" ADD VALUE 'EXPERIENCE';
ALTER TYPE "content_post_type" ADD VALUE 'UPDATE';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "content_posts" ADD COLUMN     "comments_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "favorites_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "likes_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shares_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "dm_messages" DROP COLUMN "context",
ADD COLUMN     "context" "DMMessageContext" NOT NULL DEFAULT 'DM';

-- AlterTable
ALTER TABLE "dm_requests" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "type" "support_type" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "dm_threads" ADD COLUMN     "unread_count_user_one" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unread_count_user_two" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "main_categories" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "product_groups" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "sub_name" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "posts_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trust_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "truster_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unseen_feed_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sub_categories" ADD COLUMN     "image_url" TEXT;

-- DropEnum
DROP TYPE "dm_message_context";

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_idx" ON "admin_logs"("admin_id");

-- CreateIndex
CREATE INDEX "brand_survey_answers_question_id_idx" ON "brand_survey_answers"("question_id");

-- CreateIndex
CREATE INDEX "brand_survey_answers_user_id_idx" ON "brand_survey_answers"("user_id");

-- CreateIndex
CREATE INDEX "brand_surveys_brand_id_idx" ON "brand_surveys"("brand_id");

-- CreateIndex
CREATE INDEX "bridge_posts_brand_id_idx" ON "bridge_posts"("brand_id");

-- CreateIndex
CREATE INDEX "bridge_posts_user_id_idx" ON "bridge_posts"("user_id");

-- CreateIndex
CREATE INDEX "choice_comments_choice_id_idx" ON "choice_comments"("choice_id");

-- CreateIndex
CREATE INDEX "choice_comments_user_id_idx" ON "choice_comments"("user_id");

-- CreateIndex
CREATE INDEX "content_collections_user_id_idx" ON "content_collections"("user_id");

-- CreateIndex
CREATE INDEX "content_comment_votes_user_id_idx" ON "content_comment_votes"("user_id");

-- CreateIndex
CREATE INDEX "content_comment_votes_comment_id_idx" ON "content_comment_votes"("comment_id");

-- CreateIndex
CREATE INDEX "content_comments_post_id_idx" ON "content_comments"("post_id");

-- CreateIndex
CREATE INDEX "content_comments_user_id_idx" ON "content_comments"("user_id");

-- CreateIndex
CREATE INDEX "content_comments_parent_id_idx" ON "content_comments"("parent_id");

-- CreateIndex
CREATE INDEX "content_favorites_user_id_idx" ON "content_favorites"("user_id");

-- CreateIndex
CREATE INDEX "content_favorites_post_id_idx" ON "content_favorites"("post_id");

-- CreateIndex
CREATE INDEX "content_likes_user_id_idx" ON "content_likes"("user_id");

-- CreateIndex
CREATE INDEX "content_likes_post_id_idx" ON "content_likes"("post_id");

-- CreateIndex
CREATE INDEX "content_likes_comment_id_idx" ON "content_likes"("comment_id");

-- CreateIndex
CREATE INDEX "content_post_tags_post_id_idx" ON "content_post_tags"("post_id");

-- CreateIndex
CREATE INDEX "content_post_views_post_id_idx" ON "content_post_views"("post_id");

-- CreateIndex
CREATE INDEX "content_posts_user_id_idx" ON "content_posts"("user_id");

-- CreateIndex
CREATE INDEX "content_posts_user_id_created_at_idx" ON "content_posts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "content_posts_sub_category_id_idx" ON "content_posts"("sub_category_id");

-- CreateIndex
CREATE INDEX "content_posts_type_idx" ON "content_posts"("type");

-- CreateIndex
CREATE INDEX "content_posts_main_category_id_idx" ON "content_posts"("main_category_id");

-- CreateIndex
CREATE INDEX "content_posts_product_id_idx" ON "content_posts"("product_id");

-- CreateIndex
CREATE INDEX "content_posts_created_at_idx" ON "content_posts"("created_at");

-- CreateIndex
CREATE INDEX "content_ratings_user_id_idx" ON "content_ratings"("user_id");

-- CreateIndex
CREATE INDEX "content_ratings_comment_id_idx" ON "content_ratings"("comment_id");

-- CreateIndex
CREATE INDEX "dm_messages_thread_id_idx" ON "dm_messages"("thread_id");

-- CreateIndex
CREATE INDEX "dm_messages_thread_id_is_read_idx" ON "dm_messages"("thread_id", "is_read");

-- CreateIndex
CREATE INDEX "dm_messages_sender_id_idx" ON "dm_messages"("sender_id");

-- CreateIndex
CREATE INDEX "dm_requests_from_user_id_idx" ON "dm_requests"("from_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_to_user_id_idx" ON "dm_requests"("to_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_status_idx" ON "dm_requests"("status");

-- CreateIndex
CREATE INDEX "dm_support_sessions_thread_id_idx" ON "dm_support_sessions"("thread_id");

-- CreateIndex
CREATE INDEX "dm_support_sessions_helper_id_idx" ON "dm_support_sessions"("helper_id");

-- CreateIndex
CREATE INDEX "dm_threads_user_one_id_idx" ON "dm_threads"("user_one_id");

-- CreateIndex
CREATE INDEX "dm_threads_user_two_id_idx" ON "dm_threads"("user_two_id");

-- CreateIndex
CREATE INDEX "expert_answers_request_id_idx" ON "expert_answers"("request_id");

-- CreateIndex
CREATE INDEX "expert_answers_expert_user_id_idx" ON "expert_answers"("expert_user_id");

-- CreateIndex
CREATE INDEX "expert_requests_user_id_idx" ON "expert_requests"("user_id");

-- CreateIndex
CREATE INDEX "expert_requests_status_idx" ON "expert_requests"("status");

-- CreateIndex
CREATE INDEX "feed_highlights_post_id_idx" ON "feed_highlights"("post_id");

-- CreateIndex
CREATE INDEX "feeds_user_id_idx" ON "feeds"("user_id");

-- CreateIndex
CREATE INDEX "feeds_user_id_seen_idx" ON "feeds"("user_id", "seen");

-- CreateIndex
CREATE INDEX "feeds_user_id_source_idx" ON "feeds"("user_id", "source");

-- CreateIndex
CREATE INDEX "feeds_post_id_idx" ON "feeds"("post_id");

-- CreateIndex
CREATE INDEX "inventories_user_id_idx" ON "inventories"("user_id");

-- CreateIndex
CREATE INDEX "inventories_product_id_idx" ON "inventories"("product_id");

-- CreateIndex
CREATE INDEX "inventories_user_id_has_owned_idx" ON "inventories"("user_id", "has_owned");

-- CreateIndex
CREATE INDEX "inventory_media_inventory_id_idx" ON "inventory_media"("inventory_id");

-- CreateIndex
CREATE INDEX "inventory_media_inventory_id_type_idx" ON "inventory_media"("inventory_id", "type");

-- CreateIndex
CREATE INDEX "lootboxes_user_id_idx" ON "lootboxes"("user_id");

-- CreateIndex
CREATE INDEX "lootboxes_status_idx" ON "lootboxes"("status");

-- CreateIndex
CREATE INDEX "moderation_actions_moderator_id_idx" ON "moderation_actions"("moderator_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions"("target_user_id");

-- CreateIndex
CREATE INDEX "nft_claims_user_id_idx" ON "nft_claims"("user_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_status_idx" ON "nft_market_listings"("status");

-- CreateIndex
CREATE INDEX "nft_market_listings_nft_id_idx" ON "nft_market_listings"("nft_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_listed_by_user_id_idx" ON "nft_market_listings"("listed_by_user_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_status_price_idx" ON "nft_market_listings"("status", "price");

-- CreateIndex
CREATE INDEX "nft_transactions_nft_id_idx" ON "nft_transactions"("nft_id");

-- CreateIndex
CREATE INDEX "nft_transactions_to_user_id_idx" ON "nft_transactions"("to_user_id");

-- CreateIndex
CREATE INDEX "nft_transactions_from_user_id_idx" ON "nft_transactions"("from_user_id");

-- CreateIndex
CREATE INDEX "post_tags_post_id_idx" ON "post_tags"("post_id");

-- CreateIndex
CREATE INDEX "product_experiences_inventory_id_idx" ON "product_experiences"("inventory_id");

-- CreateIndex
CREATE INDEX "tips_token_transfers_from_user_id_idx" ON "tips_token_transfers"("from_user_id");

-- CreateIndex
CREATE INDEX "tips_token_transfers_to_user_id_idx" ON "tips_token_transfers"("to_user_id");

-- CreateIndex
CREATE INDEX "trust_relations_truster_id_idx" ON "trust_relations"("truster_id");

-- CreateIndex
CREATE INDEX "trust_relations_trusted_user_id_idx" ON "trust_relations"("trusted_user_id");

-- CreateIndex
CREATE INDEX "user_avatars_user_id_idx" ON "user_avatars"("user_id");

-- CreateIndex
CREATE INDEX "user_avatars_user_id_is_active_idx" ON "user_avatars"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE INDEX "user_badges_badge_id_claimed_idx" ON "user_badges"("badge_id", "claimed");

-- CreateIndex
CREATE INDEX "user_kyc_records_user_id_idx" ON "user_kyc_records"("user_id");

-- CreateIndex
CREATE INDEX "user_kyc_records_review_status_idx" ON "user_kyc_records"("review_status");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE INDEX "user_titles_user_id_idx" ON "user_titles"("user_id");

-- CreateIndex
CREATE INDEX "user_trust_scores_user_id_idx" ON "user_trust_scores"("user_id");

-- CreateIndex
CREATE INDEX "wishbox_rewards_user_id_idx" ON "wishbox_rewards"("user_id");

-- CreateIndex
CREATE INDEX "wishbox_rewards_event_id_idx" ON "wishbox_rewards"("event_id");
