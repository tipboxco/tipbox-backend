ALTER TABLE "dm_requests"
  ADD COLUMN IF NOT EXISTS "from_user_rating" INTEGER,
  ADD COLUMN IF NOT EXISTS "to_user_rating" INTEGER,
  ADD COLUMN IF NOT EXISTS "closed_by_from_user_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closed_by_to_user_at" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "dm_request_status" ADD VALUE IF NOT EXISTS 'AWAITING_COMPLETION';
ALTER TYPE "dm_request_status" ADD VALUE IF NOT EXISTS 'COMPLETED';
