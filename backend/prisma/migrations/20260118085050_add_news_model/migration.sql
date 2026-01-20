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

-- CreateIndex
CREATE INDEX "news_brand_id_idx" ON "news"("brand_id");

-- CreateIndex
CREATE INDEX "news_created_at_idx" ON "news"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "news_likes_user_id_news_id_key" ON "news_likes"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "news_likes_user_id_idx" ON "news_likes"("user_id");

-- CreateIndex
CREATE INDEX "news_likes_news_id_idx" ON "news_likes"("news_id");

-- CreateIndex
CREATE INDEX "news_comments_news_id_idx" ON "news_comments"("news_id");

-- CreateIndex
CREATE INDEX "news_comments_user_id_idx" ON "news_comments"("user_id");

-- CreateIndex
CREATE INDEX "news_comments_parent_id_idx" ON "news_comments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_comment_likes_user_id_comment_id_key" ON "news_comment_likes"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "news_comment_likes_user_id_idx" ON "news_comment_likes"("user_id");

-- CreateIndex
CREATE INDEX "news_comment_likes_comment_id_idx" ON "news_comment_likes"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_shares_user_id_news_id_key" ON "news_shares"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "news_shares_news_id_idx" ON "news_shares"("news_id");

-- CreateIndex
CREATE INDEX "news_shares_user_id_idx" ON "news_shares"("user_id");

-- CreateIndex
CREATE INDEX "news_shares_share_type_idx" ON "news_shares"("share_type");

-- CreateIndex
CREATE UNIQUE INDEX "news_favorites_user_id_news_id_key" ON "news_favorites"("user_id", "news_id");

-- CreateIndex
CREATE INDEX "news_favorites_user_id_idx" ON "news_favorites"("user_id");

-- CreateIndex
CREATE INDEX "news_favorites_news_id_idx" ON "news_favorites"("news_id");

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
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "news_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_shares" ADD CONSTRAINT "news_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_shares" ADD CONSTRAINT "news_shares_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_favorites" ADD CONSTRAINT "news_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_favorites" ADD CONSTRAINT "news_favorites_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;
