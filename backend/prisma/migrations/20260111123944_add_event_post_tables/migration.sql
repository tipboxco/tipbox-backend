-- AlterTable
ALTER TABLE "wishbox_events" ADD COLUMN     "main_category_id" UUID,
ADD COLUMN     "sub_category_id" UUID;

-- CreateTable
CREATE TABLE "event_posts" (
    "id" VARCHAR(26) NOT NULL,
    "event_id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_post_likes" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_post_comments" (
    "id" VARCHAR(26) NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_posts_event_id_created_at_idx" ON "event_posts"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "event_posts_user_id_event_id_idx" ON "event_posts"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "event_post_likes_post_id_idx" ON "event_post_likes"("post_id");

-- CreateIndex
CREATE INDEX "event_post_likes_user_id_idx" ON "event_post_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_post_likes_post_id_user_id_key" ON "event_post_likes"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "event_post_comments_post_id_created_at_idx" ON "event_post_comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "event_post_comments_user_id_idx" ON "event_post_comments"("user_id");

-- CreateIndex
CREATE INDEX "wishbox_events_status_start_date_end_date_idx" ON "wishbox_events"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "wishbox_events_main_category_id_idx" ON "wishbox_events"("main_category_id");

-- AddForeignKey
ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_post_likes" ADD CONSTRAINT "event_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "event_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_post_likes" ADD CONSTRAINT "event_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_post_comments" ADD CONSTRAINT "event_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "event_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_post_comments" ADD CONSTRAINT "event_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
