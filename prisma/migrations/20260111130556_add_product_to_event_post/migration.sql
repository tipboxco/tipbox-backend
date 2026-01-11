-- AlterTable
ALTER TABLE "event_posts" ADD COLUMN     "product_id" UUID;

-- CreateIndex
CREATE INDEX "event_posts_product_id_idx" ON "event_posts"("product_id");

-- AddForeignKey
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
