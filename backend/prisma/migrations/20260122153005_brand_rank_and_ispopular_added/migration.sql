-- AlterEnum
ALTER TYPE "badge_type" ADD VALUE 'BRAND';

-- DropForeignKey
ALTER TABLE "email_verification_codes" DROP CONSTRAINT "email_verification_codes_user_id_fkey";

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "is_popular" BOOLEAN DEFAULT false,
ADD COLUMN     "rank" INTEGER DEFAULT 0,
ADD COLUMN     "tags" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "dm_messages" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "edited_at" TIMESTAMP(3),
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size" BIGINT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "media_type" TEXT,
ADD COLUMN     "media_url" TEXT,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "reply_to_message_id" UUID,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent',
ADD COLUMN     "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "dm_threads" ADD COLUMN     "last_message_at" TIMESTAMP(3),
ADD COLUMN     "last_message_id" UUID;

-- AlterTable
ALTER TABLE "email_verification_codes" ADD COLUMN     "auth0_id" TEXT;

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
CREATE INDEX "dm_messages_thread_id_sent_at_idx" ON "dm_messages"("thread_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "dm_messages_reply_to_message_id_idx" ON "dm_messages"("reply_to_message_id");

-- CreateIndex
CREATE INDEX "dm_messages_status_idx" ON "dm_messages"("status");

-- CreateIndex
CREATE INDEX "dm_messages_is_deleted_idx" ON "dm_messages"("is_deleted");

-- CreateIndex
CREATE INDEX "dm_threads_last_message_at_idx" ON "dm_threads"("last_message_at");

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_code_idx" ON "email_verification_codes"("user_id", "code");

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "dm_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
