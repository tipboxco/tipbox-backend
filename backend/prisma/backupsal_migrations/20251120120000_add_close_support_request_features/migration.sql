-- AlterTable
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dm_requests' AND column_name = 'from_user_rating') THEN
    ALTER TABLE "dm_requests" ADD COLUMN "from_user_rating" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dm_requests' AND column_name = 'to_user_rating') THEN
    ALTER TABLE "dm_requests" ADD COLUMN "to_user_rating" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dm_requests' AND column_name = 'closed_by_from_user_at') THEN
    ALTER TABLE "dm_requests" ADD COLUMN "closed_by_from_user_at" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dm_requests' AND column_name = 'closed_by_to_user_at') THEN
    ALTER TABLE "dm_requests" ADD COLUMN "closed_by_to_user_at" TIMESTAMP(3);
  END IF;
END
$$;

-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dm_request_status' AND e.enumlabel = 'AWAITING_COMPLETION'
  ) THEN
    ALTER TYPE "dm_request_status" ADD VALUE 'AWAITING_COMPLETION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dm_request_status' AND e.enumlabel = 'COMPLETED'
  ) THEN
    ALTER TYPE "dm_request_status" ADD VALUE 'COMPLETED';
  END IF;
END
$$;

