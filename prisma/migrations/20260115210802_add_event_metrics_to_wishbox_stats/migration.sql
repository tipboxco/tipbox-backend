-- AlterTable
ALTER TABLE "wishbox_stats" 
ADD COLUMN "event_posts_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "event_likes_received" INTEGER NOT NULL DEFAULT 0;
