-- CreateTable
CREATE TABLE "post_update_content" (
    "id" UUID NOT NULL,
    "post_id" VARCHAR(26) NOT NULL,
    "experience_post_id" VARCHAR(26) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_update_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_update_content_post_id_key" ON "post_update_content"("post_id");

-- CreateIndex
CREATE INDEX "post_update_content_post_id_idx" ON "post_update_content"("post_id");

-- CreateIndex
CREATE INDEX "post_update_content_experience_post_id_idx" ON "post_update_content"("experience_post_id");

-- AddForeignKey
ALTER TABLE "post_update_content" ADD CONSTRAINT "post_update_content_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_update_content" ADD CONSTRAINT "post_update_content_experience_post_id_fkey" FOREIGN KEY ("experience_post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
