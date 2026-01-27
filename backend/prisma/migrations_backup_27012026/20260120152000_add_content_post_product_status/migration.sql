-- Add product_status to content_posts for Roasts event posts

-- Enum type for post product status (app sends: own | tried)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_post_product_status') THEN
    CREATE TYPE "content_post_product_status" AS ENUM ('own', 'tried');
  END IF;
END$$;

ALTER TABLE "content_posts"
ADD COLUMN IF NOT EXISTS "product_status" "content_post_product_status";

CREATE INDEX IF NOT EXISTS "content_posts_product_status_idx" ON "content_posts" ("product_status");

