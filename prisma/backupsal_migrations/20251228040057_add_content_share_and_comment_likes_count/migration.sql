-- CreateEnum
CREATE TYPE "share_type" AS ENUM ('INTERNAL_REPOST', 'EXTERNAL_SHARE');

-- AlterTable
ALTER TABLE "content_comments" ADD COLUMN "likes_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "content_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "share_type" "share_type" NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_shares_post_id_idx" ON "content_shares"("post_id");

-- CreateIndex
CREATE INDEX "content_shares_user_id_idx" ON "content_shares"("user_id");

-- CreateIndex
CREATE INDEX "content_shares_share_type_idx" ON "content_shares"("share_type");

-- CreateIndex
CREATE UNIQUE INDEX "content_shares_user_id_post_id_key" ON "content_shares"("user_id", "post_id");

-- AddForeignKey
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

