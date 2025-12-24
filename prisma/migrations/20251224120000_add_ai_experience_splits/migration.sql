-- CreateTable
CREATE TABLE "ai_experience_splits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID,
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

    CONSTRAINT "ai_experience_splits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_experience_splits_user_id_idx" ON "ai_experience_splits"("user_id");

-- CreateIndex
CREATE INDEX "ai_experience_splits_product_id_idx" ON "ai_experience_splits"("product_id");

-- CreateIndex
CREATE INDEX "ai_experience_splits_created_at_idx" ON "ai_experience_splits"("created_at");

-- AddForeignKey
ALTER TABLE "ai_experience_splits" ADD CONSTRAINT "ai_experience_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_experience_splits" ADD CONSTRAINT "ai_experience_splits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "inventories" ADD COLUMN "ai_split_id" UUID;

-- CreateIndex
CREATE INDEX "inventories_ai_split_id_idx" ON "inventories"("ai_split_id");

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_ai_split_id_fkey" FOREIGN KEY ("ai_split_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "content_posts" ADD COLUMN "ai_split_id" UUID;

-- CreateIndex
CREATE INDEX "content_posts_ai_split_id_idx" ON "content_posts"("ai_split_id");

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_ai_split_id_fkey" FOREIGN KEY ("ai_split_id") REFERENCES "ai_experience_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

