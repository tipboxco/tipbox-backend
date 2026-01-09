-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('POST_LIKED', 'POST_COMMENTED', 'POST_SHARED', 'POST_FAVORITED', 'COMMENT_LIKED', 'COMMENT_REPLIED', 'NEW_TRUSTER', 'NEW_TRUSTED_BY', 'NEW_MESSAGE', 'DM_REQUEST_RECEIVED', 'DM_REQUEST_ACCEPTED', 'SUPPORT_REQUEST_ACCEPTED', 'COLLECTION_POST_ADDED', 'COLLECTION_SHARED', 'NEW_BADGE', 'ACHIEVEMENT_UNLOCKED', 'LEVEL_UP', 'REWARD_EARNED', 'EXPERT_REQUEST_AVAILABLE', 'EXPERT_REQUEST_ANSWERED', 'EVENT_STARTED', 'EVENT_ENDING_SOON', 'EVENT_REWARD_AVAILABLE', 'SYSTEM_ANNOUNCEMENT', 'ACCOUNT_SECURITY', 'TIPS_RECEIVED', 'TIPS_SENT');

-- AlterTable
ALTER TABLE "ai_experience_splits" ALTER COLUMN "prompt_version" SET DEFAULT 'v1.0';

-- AlterTable
ALTER TABLE "content_posts" ADD COLUMN     "event_id" VARCHAR(26);

-- AlterTable
ALTER TABLE "content_shares" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "collection_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "message_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notification_email_enabled" BOOLEAN DEFAULT true,
ADD COLUMN     "notification_in_app_enabled" BOOLEAN DEFAULT true,
ADD COLUMN     "notification_push_enabled" BOOLEAN DEFAULT true,
ADD COLUMN     "post_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "support_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trust_notifications" BOOLEAN NOT NULL DEFAULT true;

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

-- CreateIndex
CREATE INDEX "content_posts_event_id_idx" ON "content_posts"("event_id");

-- CreateIndex
CREATE INDEX "content_posts_event_id_created_at_idx" ON "content_posts"("event_id", "created_at");

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
