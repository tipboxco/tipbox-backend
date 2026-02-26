-- CreateEnum
CREATE TYPE "DMMessageContext" AS ENUM ('DM', 'SUPPORT');

-- CreateEnum
CREATE TYPE "kyc_review_status" AS ENUM ('INIT', 'PENDING', 'COMPLETED', 'DECLINED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "kyc_review_result" AS ENUM ('NULL', 'GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "kyc_provider" AS ENUM ('SUMSUB');

-- CreateEnum
CREATE TYPE "user_visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'FRIENDS_ONLY');

-- CreateEnum
CREATE TYPE "login_attempt_status" AS ENUM ('SUCCESS', 'FAILED', 'LOCKED');

-- CreateEnum
CREATE TYPE "product_suggestion_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "content_post_type" AS ENUM ('FREE', 'TIPS', 'COMPARE', 'QUESTION', 'EXPERIENCE', 'UPDATE');

-- CreateEnum
CREATE TYPE "share_type" AS ENUM ('INTERNAL_REPOST', 'EXTERNAL_SHARE');

-- CreateEnum
CREATE TYPE "question_answer_format" AS ENUM ('SHORT', 'LONG', 'POLL', 'CHOICE');

-- CreateEnum
CREATE TYPE "tip_category" AS ENUM ('USAGE', 'PURCHASE', 'CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "vote_type" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "badge_type" AS ENUM ('ACHIEVEMENT', 'EVENT', 'COSMETIC', 'BRAND');

-- CreateEnum
CREATE TYPE "badge_rarity" AS ENUM ('COMMON', 'RARE', 'EPIC');

-- CreateEnum
CREATE TYPE "badge_visibility" AS ENUM ('PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "achievement_difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "vesting_status" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "survey_question_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "leaderboard_period" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "wallet_provider" AS ENUM ('METAMASK', 'WALLETCONNECT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "transaction_action_type" AS ENUM ('TIP_SEND', 'TIP_RECEIVE', 'CLAIM_REWARD', 'CLAIM_BADGE', 'NFT_BUY', 'NFT_SELL', 'SWAP_TIP_TO_SOL', 'SWAP_SOL_TO_TIP', 'AIRDROP', 'FEE');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('created', 'pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "nft_type" AS ENUM ('BADGE', 'COSMETIC', 'LOOTBOX');

-- CreateEnum
CREATE TYPE "nft_rarity" AS ENUM ('COMMON', 'RARE', 'EPIC');

-- CreateEnum
CREATE TYPE "nft_transaction_type" AS ENUM ('MINT', 'TRANSFER', 'PURCHASE');

-- CreateEnum
CREATE TYPE "nft_market_listing_status" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "lootbox_status" AS ENUM ('LOCKED', 'OPENABLE', 'CLAIMED');

-- CreateEnum
CREATE TYPE "wishbox_event_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "wishbox_reward_type" AS ENUM ('TIPS', 'BADGE', 'TITLE');

-- CreateEnum
CREATE TYPE "wishbox_event_feed_type" AS ENUM ('PICKS', 'ROASTS');

-- CreateEnum
CREATE TYPE "dm_request_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'AWAITING_COMPLETION', 'COMPLETED', 'REPORTED');

-- CreateEnum
CREATE TYPE "support_type" AS ENUM ('GENERAL', 'TECHNICAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "feed_source" AS ENUM ('TRUSTER', 'CATEGORY_MATCH', 'TRENDING', 'NEW_USER', 'BOOSTED', 'TRUSTER_NETWORK', 'MUTUAL_TRUST', 'INVENTORY_MATCH', 'PRODUCT_GROUP_MATCH', 'ENGAGEMENT_HIGH');

-- CreateEnum
CREATE TYPE "feed_highlight_reason" AS ENUM ('MOST_LIKED', 'STAFF_PICK', 'BOOSTED');

-- CreateEnum
CREATE TYPE "trend_period" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "moderation_action_type" AS ENUM ('BAN', 'WARN', 'MUTE', 'CONTENT_REMOVED');

-- CreateEnum
CREATE TYPE "manual_review_flag_status" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "expert_request_status" AS ENUM ('PENDING', 'BROADCASTING', 'EXPERT_FOUND', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('POST_LIKED', 'POST_COMMENTED', 'POST_SHARED', 'POST_FAVORITED', 'COMMENT_LIKED', 'COMMENT_REPLIED', 'NEW_TRUSTER', 'NEW_TRUSTED_BY', 'NEW_MESSAGE', 'DM_REQUEST_RECEIVED', 'DM_REQUEST_ACCEPTED', 'DM_REQUEST_DECLINED', 'SUPPORT_REQUEST_ACCEPTED', 'COLLECTION_POST_ADDED', 'COLLECTION_SHARED', 'NEW_BADGE', 'ACHIEVEMENT_UNLOCKED', 'LEVEL_UP', 'REWARD_EARNED', 'EXPERT_REQUEST_AVAILABLE', 'EXPERT_REQUEST_ANSWERED', 'EVENT_STARTED', 'EVENT_ENDING_SOON', 'EVENT_REWARD_AVAILABLE', 'SYSTEM_ANNOUNCEMENT', 'ACCOUNT_SECURITY', 'TIPS_RECEIVED', 'TIPS_SENT');

-- CreateEnum
CREATE TYPE "reward_claim_type" AS ENUM ('TIPS', 'BADGE', 'ACHIEVEMENT', 'LADDER', 'SUPPORT', 'EVENT');

-- CreateEnum
CREATE TYPE "reward_source_type" AS ENUM ('LADDER_REWARD', 'TIPS_RECEIVED', 'SUPPORT_SESSION', 'BADGE_EARNED', 'ACHIEVEMENT_UNLOCKED', 'EVENT_PARTICIPATION', 'SYSTEM_GRANT');

-- CreateEnum
CREATE TYPE "reward_claim_status" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "auth0_id" TEXT,
    "status" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "user_name" TEXT,
    "bio" TEXT,
    "banner_url" TEXT,
    "country" TEXT,
    "birth_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "posts_count" INTEGER NOT NULL DEFAULT 0,
    "trust_count" INTEGER NOT NULL DEFAULT 0,
    "truster_count" INTEGER NOT NULL DEFAULT 0,
    "unseen_feed_count" INTEGER NOT NULL DEFAULT 0,
    "cosmetic_badge_id" UUID,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme_id" UUID,
    "receive_notifications" BOOLEAN,
    "visibility" "user_visibility",
    "notification_email_enabled" BOOLEAN DEFAULT true,
    "notification_push_enabled" BOOLEAN DEFAULT true,
    "notification_in_app_enabled" BOOLEAN DEFAULT true,
    "trust_notifications" BOOLEAN NOT NULL DEFAULT true,
    "support_notifications" BOOLEAN NOT NULL DEFAULT true,
    "message_notifications" BOOLEAN NOT NULL DEFAULT true,
    "collection_notifications" BOOLEAN NOT NULL DEFAULT true,
    "post_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "nft_notifications" BOOLEAN NOT NULL DEFAULT true,
    "reward_notifications" BOOLEAN NOT NULL DEFAULT true,
    "transaction_notifications" BOOLEAN NOT NULL DEFAULT true,
    "wallet_notifications" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_relations" (
    "id" UUID NOT NULL,
    "truster_id" UUID NOT NULL,
    "trusted_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mutes" (
    "id" UUID NOT NULL,
    "muter_id" UUID NOT NULL,
    "muted_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trust_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feed_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferred_categories" TEXT,
    "preferred_content_types" TEXT,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feed_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_kyc_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sumsub_applicant_id" TEXT NOT NULL,
    "review_status" "kyc_review_status" NOT NULL DEFAULT 'INIT',
    "review_result" "kyc_review_result" NOT NULL DEFAULT 'NULL',
    "review_reason" TEXT,
    "kyc_level" TEXT,
    "provider" "kyc_provider" NOT NULL DEFAULT 'SUMSUB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "user_kyc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_themes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_titles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_collections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "status" "login_attempt_status" NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "password_hash" TEXT,
    "name" TEXT,
    "auth0_id" TEXT,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "mpath" TEXT,
    "handle" TEXT,
    "rank" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "is_active" BOOLEAN DEFAULT true,
    "level" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "main_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "main_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" UUID NOT NULL,
    "main_category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_groups" (
    "id" UUID NOT NULL,
    "sub_category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,
    "sub_name" TEXT,
    "categoryId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "thumbnail" TEXT,
    "brand_id" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suggestions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "suggested_name" TEXT NOT NULL,
    "suggested_brand" TEXT,
    "description" TEXT,
    "reason" TEXT,
    "status" "product_suggestion_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,

    CONSTRAINT "product_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "has_owned" BOOLEAN NOT NULL,
    "experience_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "experience_duration_id" UUID,
    "experience_location_id" UUID,
    "experience_purpose_id" UUID,
    "experience_snippet_id" UUID,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_media" (
    "id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "content_post_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "main_category_id" UUID,
    "sub_category_id" UUID,
    "category_id" TEXT,
    "product_group_id" UUID,
    "product_id" TEXT,
    "inventory_required" BOOLEAN NOT NULL,
    "is_boosted" BOOLEAN NOT NULL,
    "boosted_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "experience_duration_id" UUID,
    "experience_location_id" UUID,
    "experience_purpose_id" UUID,
    "experience_snippet_id" UUID,
    "event_id" VARCHAR(26),

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_questions" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "expected_answer_format" "question_answer_format" NOT NULL,
    "related_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comparisons" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "product_1_id" TEXT NOT NULL,
    "product_2_id" TEXT NOT NULL,
    "comparison_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_metrics" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparison_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comparison_scores" (
    "id" UUID NOT NULL,
    "comparison_id" UUID NOT NULL,
    "metric_id" UUID NOT NULL,
    "score_product_1" INTEGER NOT NULL,
    "score_product_2" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comparison_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tips" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "tip_category" "tip_category" NOT NULL,
    "is_verified" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_post_tags" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_post_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comments" (
    "id" VARCHAR(26) NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" VARCHAR(26),
    "comment" TEXT NOT NULL,
    "is_answer" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_likes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26),
    "comment_id" VARCHAR(26),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_shares" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "share_type" "share_type" NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_collections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ratings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment_id" VARCHAR(26) NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comment_votes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment_id" VARCHAR(26) NOT NULL,
    "vote_type" "vote_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comment_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_post_views" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "user_id" UUID,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewer_ip" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_post_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_community_choices" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "reason" TEXT,
    "badge_label" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_community_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "type" "badge_type" NOT NULL,
    "rarity" "badge_rarity" NOT NULL,
    "boost_multiplier" DOUBLE PRECISION,
    "reward_multiplier" DOUBLE PRECISION,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "badge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "is_visible" BOOLEAN NOT NULL,
    "display_order" INTEGER,
    "visibility" "badge_visibility" NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" TIMESTAMP(3),

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_chains" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,

    CONSTRAINT "achievement_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_goals" (
    "id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "reward_badge_id" UUID,
    "points_required" INTEGER NOT NULL,
    "difficulty" "achievement_difficulty" NOT NULL,

    CONSTRAINT "achievement_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "progress" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "reward_type" "reward_claim_type" NOT NULL,
    "source_id" UUID,
    "source_type" "reward_source_type" NOT NULL,
    "status" "reward_claim_status" NOT NULL DEFAULT 'PENDING',
    "transaction_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,
    "category_id" UUID,
    "rank" INTEGER DEFAULT 0,
    "is_popular" BOOLEAN DEFAULT false,
    "tags" JSONB DEFAULT '[]',
    "banner_url" TEXT,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_posts" (
    "id" VARCHAR(26) NOT NULL,
    "brand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_surveys" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_survey_questions" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "type" "survey_question_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_survey_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answer_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_followers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "followed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_user_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "comments_count" INTEGER NOT NULL,
    "surveys_participated" INTEGER NOT NULL,
    "trust_score" DOUBLE PRECISION NOT NULL,
    "last_interaction_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_leaderboards" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period" "leaderboard_period" NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_leaderboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_rewards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "banner_image_url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'tipbox',
    "author" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_likes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_comments" (
    "id" VARCHAR(26) NOT NULL,
    "news_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" VARCHAR(26),
    "comment" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_comment_likes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment_id" VARCHAR(26) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_shares" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "share_type" "share_type" NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_address" TEXT NOT NULL,
    "provider" "wallet_provider" NOT NULL,
    "is_connected" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locked_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "action_type" "transaction_action_type" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'created',
    "amount" DOUBLE PRECISION,
    "from_address" TEXT,
    "to_address" TEXT,
    "metadata" JSONB,
    "tx_hash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'backend',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips_token_transfers" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tips_token_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "type" "nft_type" NOT NULL,
    "rarity" "nft_rarity" NOT NULL,
    "is_transferable" BOOLEAN NOT NULL,
    "current_owner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nfts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_transactions" (
    "id" UUID NOT NULL,
    "nft_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID NOT NULL,
    "price" DOUBLE PRECISION,
    "transaction_type" "nft_transaction_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_market_listings" (
    "id" UUID NOT NULL,
    "nft_id" UUID NOT NULL,
    "listed_by_user_id" UUID NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "nft_market_listing_status" NOT NULL DEFAULT 'ACTIVE',
    "listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_market_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_attributes" (
    "id" UUID NOT NULL,
    "nft_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lootboxes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tips_locked" DOUBLE PRECISION NOT NULL,
    "status" "lootbox_status" NOT NULL DEFAULT 'LOCKED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lootboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nft_id" UUID,
    "tips_amount" DOUBLE PRECISION NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishbox_events" (
    "id" VARCHAR(26) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "wishbox_event_status" NOT NULL DEFAULT 'DRAFT',
    "feed_type" "wishbox_event_feed_type" NOT NULL DEFAULT 'PICKS',
    "product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,
    "brand_id" UUID,
    "main_category_id" UUID,
    "sub_category_id" UUID,

    CONSTRAINT "wishbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishbox_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_id" VARCHAR(26) NOT NULL,
    "total_participated" INTEGER NOT NULL,
    "total_comments" INTEGER NOT NULL,
    "helpful_votes_received" INTEGER NOT NULL,
    "event_posts_count" INTEGER NOT NULL DEFAULT 0,
    "event_likes_received" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishbox_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishbox_rewards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_id" VARCHAR(26) NOT NULL,
    "reward_type" "wishbox_reward_type" NOT NULL,
    "reward_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishbox_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_badges" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(26) NOT NULL,
    "badge_id" UUID NOT NULL,
    "requirement_type" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "display_order" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_threads" (
    "id" UUID NOT NULL,
    "user_one_id" UUID NOT NULL,
    "user_two_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unread_count_user_one" INTEGER NOT NULL DEFAULT 0,
    "unread_count_user_two" INTEGER NOT NULL DEFAULT 0,
    "is_support_thread" BOOLEAN NOT NULL DEFAULT false,
    "last_message_id" UUID,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "dm_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "context" "DMMessageContext" NOT NULL DEFAULT 'DM',
    "media_url" TEXT,
    "media_type" TEXT,
    "thumbnail_url" TEXT,
    "file_name" TEXT,
    "file_size" BIGINT,
    "caption" TEXT,
    "reply_to_message_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_requests" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "status" "dm_request_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "type" "support_type" NOT NULL DEFAULT 'GENERAL',
    "thread_id" UUID,
    "from_user_rating" INTEGER,
    "to_user_rating" INTEGER,
    "closed_by_from_user_at" TIMESTAMP(3),
    "closed_by_to_user_at" TIMESTAMP(3),

    CONSTRAINT "dm_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_request_reports" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" UUID NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_support_sessions" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "helper_id" UUID NOT NULL,
    "tips_amount" DOUBLE PRECISION NOT NULL,
    "supported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dm_support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_feedbacks" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dm_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeds" (
    "id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "source" "feed_source" NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_highlights" (
    "id" VARCHAR(26) NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "reason" "feed_highlight_reason" NOT NULL,
    "highlighted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_posts" (
    "id" VARCHAR(26) NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "trend_period" "trend_period" NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trending_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "action_type" "moderation_action_type" NOT NULL,
    "content_type" TEXT,
    "content_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_review_flags" (
    "id" UUID NOT NULL,
    "flagged_by_user_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "manual_review_flag_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_review_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "tips_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "expert_request_status" NOT NULL DEFAULT 'PENDING',
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_request_media" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_request_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_answers" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "expert_user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_experience_splits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" TEXT,
    "original_experience" TEXT NOT NULL,
    "price_and_shopping" TEXT,
    "product_and_usage" TEXT,
    "price_and_shopping_rating" INTEGER,
    "product_and_usage_rating" INTEGER,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
    "prompt_version" TEXT NOT NULL DEFAULT 'v1.0',
    "tokens_used" INTEGER,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "price_and_shopping_is_enhanced" BOOLEAN,
    "price_and_shopping_placeholder" TEXT,
    "product_and_usage_is_enhanced" BOOLEAN,
    "product_and_usage_placeholder" TEXT,

    CONSTRAINT "ai_experience_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_options" (
    "id" UUID NOT NULL,
    "image" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_durations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_purposes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_purposes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_id_key" ON "users"("auth0_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_name_key" ON "profiles"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "trust_relations_truster_id_idx" ON "trust_relations"("truster_id");

-- CreateIndex
CREATE INDEX "trust_relations_trusted_user_id_idx" ON "trust_relations"("trusted_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_relations_truster_id_trusted_user_id_key" ON "trust_relations"("truster_id", "trusted_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_user_id_key" ON "user_blocks"("blocker_id", "blocked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_mutes_muter_id_muted_user_id_key" ON "user_mutes"("muter_id", "muted_user_id");

-- CreateIndex
CREATE INDEX "user_trust_scores_user_id_idx" ON "user_trust_scores"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_feed_preferences_user_id_key" ON "user_feed_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_avatars_user_id_idx" ON "user_avatars"("user_id");

-- CreateIndex
CREATE INDEX "user_avatars_user_id_is_active_idx" ON "user_avatars"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_kyc_records_sumsub_applicant_id_key" ON "user_kyc_records"("sumsub_applicant_id");

-- CreateIndex
CREATE INDEX "user_kyc_records_user_id_idx" ON "user_kyc_records"("user_id");

-- CreateIndex
CREATE INDEX "user_kyc_records_review_status_idx" ON "user_kyc_records"("review_status");

-- CreateIndex
CREATE INDEX "user_titles_user_id_idx" ON "user_titles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_code_idx" ON "email_verification_codes"("user_id", "code");

-- CreateIndex
CREATE INDEX "email_verification_codes_email_code_idx" ON "email_verification_codes"("email", "code");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "inventories_user_id_idx" ON "inventories"("user_id");

-- CreateIndex
CREATE INDEX "inventories_product_id_idx" ON "inventories"("product_id");

-- CreateIndex
CREATE INDEX "inventories_user_id_has_owned_idx" ON "inventories"("user_id", "has_owned");

-- CreateIndex
CREATE INDEX "inventories_experience_snippet_id_idx" ON "inventories"("experience_snippet_id");

-- CreateIndex
CREATE INDEX "inventories_experience_duration_id_idx" ON "inventories"("experience_duration_id");

-- CreateIndex
CREATE INDEX "inventories_experience_location_id_idx" ON "inventories"("experience_location_id");

-- CreateIndex
CREATE INDEX "inventories_experience_purpose_id_idx" ON "inventories"("experience_purpose_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_user_id_product_id_key" ON "inventories"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_media_inventory_id_idx" ON "inventory_media"("inventory_id");

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
CREATE INDEX "content_posts_experience_snippet_id_idx" ON "content_posts"("experience_snippet_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_duration_id_idx" ON "content_posts"("experience_duration_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_location_id_idx" ON "content_posts"("experience_location_id");

-- CreateIndex
CREATE INDEX "content_posts_experience_purpose_id_idx" ON "content_posts"("experience_purpose_id");

-- CreateIndex
CREATE INDEX "content_posts_event_id_idx" ON "content_posts"("event_id");

-- CreateIndex
CREATE INDEX "content_posts_event_id_created_at_idx" ON "content_posts"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "post_media_post_id_idx" ON "post_media"("post_id");

-- CreateIndex
CREATE INDEX "post_media_post_id_order_index_idx" ON "post_media"("post_id", "order_index");

-- CreateIndex
CREATE INDEX "post_media_user_id_idx" ON "post_media"("user_id");

-- CreateIndex
CREATE INDEX "post_media_user_id_created_at_idx" ON "post_media"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_questions_post_id_key" ON "post_questions"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_comparisons_post_id_key" ON "post_comparisons"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_comparison_scores_comparison_id_metric_id_key" ON "post_comparison_scores"("comparison_id", "metric_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_tips_post_id_key" ON "post_tips"("post_id");

-- CreateIndex
CREATE INDEX "post_tags_post_id_idx" ON "post_tags"("post_id");

-- CreateIndex
CREATE INDEX "content_post_tags_post_id_idx" ON "content_post_tags"("post_id");

-- CreateIndex
CREATE INDEX "content_comments_post_id_idx" ON "content_comments"("post_id");

-- CreateIndex
CREATE INDEX "content_comments_user_id_idx" ON "content_comments"("user_id");

-- CreateIndex
CREATE INDEX "content_comments_parent_id_idx" ON "content_comments"("parent_id");

-- CreateIndex
CREATE INDEX "content_likes_user_id_idx" ON "content_likes"("user_id");

-- CreateIndex
CREATE INDEX "content_likes_post_id_idx" ON "content_likes"("post_id");

-- CreateIndex
CREATE INDEX "content_likes_comment_id_idx" ON "content_likes"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_user_id_post_id_key" ON "content_likes"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_user_id_comment_id_key" ON "content_likes"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "content_favorites_user_id_idx" ON "content_favorites"("user_id");

-- CreateIndex
CREATE INDEX "content_favorites_post_id_idx" ON "content_favorites"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_favorites_user_id_post_id_key" ON "content_favorites"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "content_shares_post_id_idx" ON "content_shares"("post_id");

-- CreateIndex
CREATE INDEX "content_shares_user_id_idx" ON "content_shares"("user_id");

-- CreateIndex
CREATE INDEX "content_shares_share_type_idx" ON "content_shares"("share_type");

-- CreateIndex
CREATE UNIQUE INDEX "content_shares_user_id_post_id_key" ON "content_shares"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "content_collections_user_id_idx" ON "content_collections"("user_id");

-- CreateIndex
CREATE INDEX "content_ratings_user_id_idx" ON "content_ratings"("user_id");

-- CreateIndex
CREATE INDEX "content_ratings_comment_id_idx" ON "content_ratings"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_ratings_user_id_comment_id_key" ON "content_ratings"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "content_comment_votes_user_id_idx" ON "content_comment_votes"("user_id");

-- CreateIndex
CREATE INDEX "content_comment_votes_comment_id_idx" ON "content_comment_votes"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_comment_votes_user_id_comment_id_key" ON "content_comment_votes"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "content_post_views_post_id_idx" ON "content_post_views"("post_id");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE INDEX "user_badges_badge_id_claimed_idx" ON "user_badges"("badge_id", "claimed");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_goal_id_key" ON "user_achievements"("user_id", "goal_id");

-- CreateIndex
CREATE INDEX "reward_claims_user_id_status_idx" ON "reward_claims"("user_id", "status");

-- CreateIndex
CREATE INDEX "reward_claims_user_id_earned_at_idx" ON "reward_claims"("user_id", "earned_at");

-- CreateIndex
CREATE INDEX "reward_claims_status_expires_at_idx" ON "reward_claims"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "brand_categories_name_key" ON "brand_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_external_id_key" ON "brands"("external_id");

-- CreateIndex
CREATE INDEX "bridge_posts_brand_id_idx" ON "bridge_posts"("brand_id");

-- CreateIndex
CREATE INDEX "bridge_posts_user_id_idx" ON "bridge_posts"("user_id");

-- CreateIndex
CREATE INDEX "brand_surveys_brand_id_idx" ON "brand_surveys"("brand_id");

-- CreateIndex
CREATE INDEX "brand_survey_answers_question_id_idx" ON "brand_survey_answers"("question_id");

-- CreateIndex
CREATE INDEX "brand_survey_answers_user_id_idx" ON "brand_survey_answers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_survey_answers_question_id_user_id_key" ON "brand_survey_answers"("question_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_followers_user_id_brand_id_key" ON "bridge_followers"("user_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_user_stats_user_id_brand_id_key" ON "bridge_user_stats"("user_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_leaderboards_brand_id_user_id_period_key" ON "bridge_leaderboards"("brand_id", "user_id", "period");

-- CreateIndex
CREATE INDEX "news_brand_id_idx" ON "news"("brand_id");

-- CreateIndex
CREATE INDEX "news_created_at_idx" ON "news"("created_at");

-- CreateIndex
CREATE INDEX "news_likes_user_id_idx" ON "news_likes"("user_id");

-- CreateIndex
CREATE INDEX "news_likes_news_id_idx" ON "news_likes"("news_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_likes_user_id_news_id_key" ON "news_likes"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "news_comments_news_id_idx" ON "news_comments"("news_id");

-- CreateIndex
CREATE INDEX "news_comments_user_id_idx" ON "news_comments"("user_id");

-- CreateIndex
CREATE INDEX "news_comments_parent_id_idx" ON "news_comments"("parent_id");

-- CreateIndex
CREATE INDEX "news_comment_likes_user_id_idx" ON "news_comment_likes"("user_id");

-- CreateIndex
CREATE INDEX "news_comment_likes_comment_id_idx" ON "news_comment_likes"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_comment_likes_user_id_comment_id_key" ON "news_comment_likes"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "news_shares_news_id_idx" ON "news_shares"("news_id");

-- CreateIndex
CREATE INDEX "news_shares_user_id_idx" ON "news_shares"("user_id");

-- CreateIndex
CREATE INDEX "news_shares_share_type_idx" ON "news_shares"("share_type");

-- CreateIndex
CREATE UNIQUE INDEX "news_shares_user_id_news_id_key" ON "news_shares"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "news_favorites_user_id_idx" ON "news_favorites"("user_id");

-- CreateIndex
CREATE INDEX "news_favorites_news_id_idx" ON "news_favorites"("news_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_favorites_user_id_news_id_key" ON "news_favorites"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_balance_idx" ON "wallets"("balance");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_provider_key" ON "wallets"("user_id", "provider");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_idx" ON "transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_action_type_idx" ON "transactions"("action_type");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_status_idx" ON "transactions"("wallet_id", "status");

-- CreateIndex
CREATE INDEX "tips_token_transfers_from_user_id_idx" ON "tips_token_transfers"("from_user_id");

-- CreateIndex
CREATE INDEX "tips_token_transfers_to_user_id_idx" ON "tips_token_transfers"("to_user_id");

-- CreateIndex
CREATE INDEX "nfts_current_owner_id_idx" ON "nfts"("current_owner_id");

-- CreateIndex
CREATE INDEX "nfts_name_idx" ON "nfts"("name");

-- CreateIndex
CREATE INDEX "nfts_type_rarity_idx" ON "nfts"("type", "rarity");

-- CreateIndex
CREATE INDEX "nfts_view_count_idx" ON "nfts"("view_count");

-- CreateIndex
CREATE INDEX "nft_transactions_nft_id_idx" ON "nft_transactions"("nft_id");

-- CreateIndex
CREATE INDEX "nft_transactions_to_user_id_idx" ON "nft_transactions"("to_user_id");

-- CreateIndex
CREATE INDEX "nft_transactions_from_user_id_idx" ON "nft_transactions"("from_user_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_status_idx" ON "nft_market_listings"("status");

-- CreateIndex
CREATE INDEX "nft_market_listings_nft_id_idx" ON "nft_market_listings"("nft_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_listed_by_user_id_idx" ON "nft_market_listings"("listed_by_user_id");

-- CreateIndex
CREATE INDEX "nft_market_listings_status_price_idx" ON "nft_market_listings"("status", "price");

-- CreateIndex
CREATE INDEX "lootboxes_user_id_idx" ON "lootboxes"("user_id");

-- CreateIndex
CREATE INDEX "lootboxes_status_idx" ON "lootboxes"("status");

-- CreateIndex
CREATE INDEX "nft_claims_user_id_idx" ON "nft_claims"("user_id");

-- CreateIndex
CREATE INDEX "wishbox_events_brand_id_idx" ON "wishbox_events"("brand_id");

-- CreateIndex
CREATE INDEX "wishbox_events_status_start_date_end_date_idx" ON "wishbox_events"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "wishbox_events_main_category_id_idx" ON "wishbox_events"("main_category_id");

-- CreateIndex
CREATE INDEX "wishbox_events_product_id_idx" ON "wishbox_events"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishbox_stats_user_id_event_id_key" ON "wishbox_stats"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "wishbox_rewards_user_id_idx" ON "wishbox_rewards"("user_id");

-- CreateIndex
CREATE INDEX "wishbox_rewards_event_id_idx" ON "wishbox_rewards"("event_id");

-- CreateIndex
CREATE INDEX "event_badges_event_id_idx" ON "event_badges"("event_id");

-- CreateIndex
CREATE INDEX "event_badges_badge_id_idx" ON "event_badges"("badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_badges_event_id_badge_id_key" ON "event_badges"("event_id", "badge_id");

-- CreateIndex
CREATE INDEX "dm_threads_user_one_id_idx" ON "dm_threads"("user_one_id");

-- CreateIndex
CREATE INDEX "dm_threads_user_two_id_idx" ON "dm_threads"("user_two_id");

-- CreateIndex
CREATE INDEX "dm_threads_is_support_thread_idx" ON "dm_threads"("is_support_thread");

-- CreateIndex
CREATE INDEX "dm_threads_last_message_at_idx" ON "dm_threads"("last_message_at");

-- CreateIndex
CREATE INDEX "dm_messages_thread_id_idx" ON "dm_messages"("thread_id");

-- CreateIndex
CREATE INDEX "dm_messages_thread_id_is_read_idx" ON "dm_messages"("thread_id", "is_read");

-- CreateIndex
CREATE INDEX "dm_messages_thread_id_sent_at_idx" ON "dm_messages"("thread_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "dm_messages_sender_id_idx" ON "dm_messages"("sender_id");

-- CreateIndex
CREATE INDEX "dm_messages_reply_to_message_id_idx" ON "dm_messages"("reply_to_message_id");

-- CreateIndex
CREATE INDEX "dm_messages_status_idx" ON "dm_messages"("status");

-- CreateIndex
CREATE INDEX "dm_messages_is_deleted_idx" ON "dm_messages"("is_deleted");

-- CreateIndex
CREATE INDEX "message_reactions_message_id_idx" ON "message_reactions"("message_id");

-- CreateIndex
CREATE INDEX "message_reactions_user_id_idx" ON "message_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_user_id_emoji_key" ON "message_reactions"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "message_read_receipts_message_id_idx" ON "message_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_user_id_idx" ON "message_read_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_receipts_message_id_user_id_key" ON "message_read_receipts"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "dm_requests_from_user_id_to_user_id_idx" ON "dm_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_from_user_id_idx" ON "dm_requests"("from_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_to_user_id_idx" ON "dm_requests"("to_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_status_idx" ON "dm_requests"("status");

-- CreateIndex
CREATE INDEX "dm_requests_thread_id_idx" ON "dm_requests"("thread_id");

-- CreateIndex
CREATE INDEX "support_request_reports_request_id_idx" ON "support_request_reports"("request_id");

-- CreateIndex
CREATE INDEX "support_request_reports_reporter_id_idx" ON "support_request_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "user_reports_reported_user_id_idx" ON "user_reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "user_reports_reporter_id_idx" ON "user_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "user_reports_category_idx" ON "user_reports"("category");

-- CreateIndex
CREATE UNIQUE INDEX "user_reports_reporter_id_reported_user_id_key" ON "user_reports"("reporter_id", "reported_user_id");

-- CreateIndex
CREATE INDEX "dm_support_sessions_thread_id_idx" ON "dm_support_sessions"("thread_id");

-- CreateIndex
CREATE INDEX "dm_support_sessions_helper_id_idx" ON "dm_support_sessions"("helper_id");

-- CreateIndex
CREATE INDEX "feeds_user_id_idx" ON "feeds"("user_id");

-- CreateIndex
CREATE INDEX "feeds_user_id_seen_idx" ON "feeds"("user_id", "seen");

-- CreateIndex
CREATE INDEX "feeds_user_id_source_idx" ON "feeds"("user_id", "source");

-- CreateIndex
CREATE INDEX "feeds_post_id_idx" ON "feeds"("post_id");

-- CreateIndex
CREATE INDEX "feeds_user_id_relevance_score_idx" ON "feeds"("user_id", "relevance_score" DESC);

-- CreateIndex
CREATE INDEX "feeds_relevance_score_created_at_idx" ON "feeds"("relevance_score" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "feeds_user_id_relevance_score_created_at_idx" ON "feeds"("user_id", "relevance_score" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "feed_highlights_post_id_idx" ON "feed_highlights"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "trending_posts_post_id_trend_period_key" ON "trending_posts"("post_id", "trend_period");

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_idx" ON "admin_logs"("admin_id");

-- CreateIndex
CREATE INDEX "moderation_actions_moderator_id_idx" ON "moderation_actions"("moderator_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions"("target_user_id");

-- CreateIndex
CREATE INDEX "expert_requests_user_id_idx" ON "expert_requests"("user_id");

-- CreateIndex
CREATE INDEX "expert_requests_status_idx" ON "expert_requests"("status");

-- CreateIndex
CREATE INDEX "expert_request_media_request_id_idx" ON "expert_request_media"("request_id");

-- CreateIndex
CREATE INDEX "expert_answers_request_id_idx" ON "expert_answers"("request_id");

-- CreateIndex
CREATE INDEX "expert_answers_expert_user_id_idx" ON "expert_answers"("expert_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "expert_answers_request_id_expert_user_id_key" ON "expert_answers"("request_id", "expert_user_id");

-- CreateIndex
CREATE INDEX "ai_experience_splits_user_id_idx" ON "ai_experience_splits"("user_id");

-- CreateIndex
CREATE INDEX "ai_experience_splits_product_id_idx" ON "ai_experience_splits"("product_id");

-- CreateIndex
CREATE INDEX "ai_experience_splits_created_at_idx" ON "ai_experience_splits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "experience_durations_name_key" ON "experience_durations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "experience_locations_name_key" ON "experience_locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "experience_purposes_name_key" ON "experience_purposes"("name");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "push_tokens_token_is_active_idx" ON "push_tokens"("token", "is_active");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cosmetic_badge_id_fkey" FOREIGN KEY ("cosmetic_badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "user_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_trusted_user_id_fkey" FOREIGN KEY ("trusted_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_truster_id_fkey" FOREIGN KEY ("truster_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muted_user_id_fkey" FOREIGN KEY ("muted_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muter_id_fkey" FOREIGN KEY ("muter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feed_preferences" ADD CONSTRAINT "user_feed_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_kyc_records" ADD CONSTRAINT "user_kyc_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("external_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_duration_id_fkey" FOREIGN KEY ("experience_duration_id") REFERENCES "experience_durations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_location_id_fkey" FOREIGN KEY ("experience_location_id") REFERENCES "experience_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_purpose_id_fkey" FOREIGN KEY ("experience_purpose_id") REFERENCES "experience_purposes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_experience_snippet_id_fkey" FOREIGN KEY ("experience_snippet_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media" ADD CONSTRAINT "inventory_media_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_duration_id_fkey" FOREIGN KEY ("experience_duration_id") REFERENCES "experience_durations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_location_id_fkey" FOREIGN KEY ("experience_location_id") REFERENCES "experience_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_purpose_id_fkey" FOREIGN KEY ("experience_purpose_id") REFERENCES "experience_purposes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_experience_snippet_id_fkey" FOREIGN KEY ("experience_snippet_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_questions" ADD CONSTRAINT "post_questions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_questions" ADD CONSTRAINT "post_questions_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_product_1_id_fkey" FOREIGN KEY ("product_1_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_product_2_id_fkey" FOREIGN KEY ("product_2_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparison_scores" ADD CONSTRAINT "post_comparison_scores_comparison_id_fkey" FOREIGN KEY ("comparison_id") REFERENCES "post_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparison_scores" ADD CONSTRAINT "post_comparison_scores_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "comparison_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tips" ADD CONSTRAINT "post_tips_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_tags" ADD CONSTRAINT "content_post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_favorites" ADD CONSTRAINT "content_favorites_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_favorites" ADD CONSTRAINT "content_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collections" ADD CONSTRAINT "content_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ratings" ADD CONSTRAINT "content_ratings_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ratings" ADD CONSTRAINT "content_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_votes" ADD CONSTRAINT "content_comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_votes" ADD CONSTRAINT "content_comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_views" ADD CONSTRAINT "content_post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_views" ADD CONSTRAINT "content_post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_community_choices" ADD CONSTRAINT "top_community_choices_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "badge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_goals" ADD CONSTRAINT "achievement_goals_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "achievement_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_goals" ADD CONSTRAINT "achievement_goals_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "achievement_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "brand_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_posts" ADD CONSTRAINT "bridge_posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_posts" ADD CONSTRAINT "bridge_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_surveys" ADD CONSTRAINT "brand_surveys_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_questions" ADD CONSTRAINT "brand_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "brand_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_answers" ADD CONSTRAINT "brand_survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "brand_survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_answers" ADD CONSTRAINT "brand_survey_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_followers" ADD CONSTRAINT "bridge_followers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_followers" ADD CONSTRAINT "bridge_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_user_stats" ADD CONSTRAINT "bridge_user_stats_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_user_stats" ADD CONSTRAINT "bridge_user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_leaderboards" ADD CONSTRAINT "bridge_leaderboards_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_leaderboards" ADD CONSTRAINT "bridge_leaderboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_likes" ADD CONSTRAINT "news_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_likes" ADD CONSTRAINT "news_likes_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "news_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "news_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_shares" ADD CONSTRAINT "news_shares_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_shares" ADD CONSTRAINT "news_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_favorites" ADD CONSTRAINT "news_favorites_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_favorites" ADD CONSTRAINT "news_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips_token_transfers" ADD CONSTRAINT "tips_token_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips_token_transfers" ADD CONSTRAINT "tips_token_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfts" ADD CONSTRAINT "nfts_current_owner_id_fkey" FOREIGN KEY ("current_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_market_listings" ADD CONSTRAINT "nft_market_listings_listed_by_user_id_fkey" FOREIGN KEY ("listed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_market_listings" ADD CONSTRAINT "nft_market_listings_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_attributes" ADD CONSTRAINT "nft_attributes_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lootboxes" ADD CONSTRAINT "lootboxes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_claims" ADD CONSTRAINT "nft_claims_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_claims" ADD CONSTRAINT "nft_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_stats" ADD CONSTRAINT "wishbox_stats_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_stats" ADD CONSTRAINT "wishbox_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_rewards" ADD CONSTRAINT "wishbox_rewards_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_rewards" ADD CONSTRAINT "wishbox_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_badges" ADD CONSTRAINT "event_badges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_badges" ADD CONSTRAINT "event_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "dm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_user_one_id_fkey" FOREIGN KEY ("user_one_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_user_two_id_fkey" FOREIGN KEY ("user_two_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "dm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "dm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "dm_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "dm_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_support_sessions" ADD CONSTRAINT "dm_support_sessions_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_support_sessions" ADD CONSTRAINT "dm_support_sessions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_feedbacks" ADD CONSTRAINT "dm_feedbacks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "dm_support_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_highlights" ADD CONSTRAINT "feed_highlights_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_posts" ADD CONSTRAINT "trending_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_review_flags" ADD CONSTRAINT "manual_review_flags_flagged_by_user_id_fkey" FOREIGN KEY ("flagged_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_requests" ADD CONSTRAINT "expert_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_request_media" ADD CONSTRAINT "expert_request_media_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "expert_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_answers" ADD CONSTRAINT "expert_answers_expert_user_id_fkey" FOREIGN KEY ("expert_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_answers" ADD CONSTRAINT "expert_answers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "expert_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_experience_splits" ADD CONSTRAINT "ai_experience_splits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_experience_splits" ADD CONSTRAINT "ai_experience_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
