-- AlterTable
ALTER TABLE "content_posts" ADD COLUMN "upvotes_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "content_post_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "vote_type" "vote_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_post_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_post_votes_user_id_idx" ON "content_post_votes"("user_id");

-- CreateIndex
CREATE INDEX "content_post_votes_post_id_idx" ON "content_post_votes"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_post_votes_user_id_post_id_key" ON "content_post_votes"("user_id", "post_id");

-- AddForeignKey
ALTER TABLE "content_post_votes" ADD CONSTRAINT "content_post_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_votes" ADD CONSTRAINT "content_post_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
