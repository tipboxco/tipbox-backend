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

-- CreateIndex
CREATE INDEX "post_media_post_id_idx" ON "post_media"("post_id");

-- CreateIndex
CREATE INDEX "post_media_post_id_order_index_idx" ON "post_media"("post_id", "order_index");

-- CreateIndex
CREATE INDEX "post_media_user_id_idx" ON "post_media"("user_id");

-- CreateIndex
CREATE INDEX "post_media_user_id_created_at_idx" ON "post_media"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
