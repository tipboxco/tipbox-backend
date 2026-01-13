-- DropForeignKey
ALTER TABLE "event_post_comments" DROP CONSTRAINT "event_post_comments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "event_post_comments" DROP CONSTRAINT "event_post_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "event_post_likes" DROP CONSTRAINT "event_post_likes_post_id_fkey";

-- DropForeignKey
ALTER TABLE "event_post_likes" DROP CONSTRAINT "event_post_likes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "event_posts" DROP CONSTRAINT "event_posts_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_posts" DROP CONSTRAINT "event_posts_product_id_fkey";

-- DropForeignKey
ALTER TABLE "event_posts" DROP CONSTRAINT "event_posts_user_id_fkey";

-- DropTable
DROP TABLE "event_post_comments";

-- DropTable
DROP TABLE "event_post_likes";

-- DropTable
DROP TABLE "event_posts";

