-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_status') THEN
    CREATE TYPE "badge_status" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END
$$;

-- AlterTable: Add status, display_order, highlights_image to badges
ALTER TABLE "badges"
  ADD COLUMN IF NOT EXISTS "status" "badge_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "highlights_image" TEXT;
