-- AlterEnum values already added in previous migrations, skipping

-- DropIndex (already dropped in previous migrations)
DROP INDEX IF EXISTS "dm_requests_from_user_id_to_user_id_key";

-- DropIndex (already dropped in previous migrations)
DROP INDEX IF EXISTS "dm_threads_user_one_id_user_two_id_key";

-- AlterTable
-- Column "context" already added in previous migration, skipping
-- ALTER TABLE "dm_messages" ADD COLUMN "context" "dm_message_context" NOT NULL DEFAULT 'DM';

-- AlterTable
ALTER TABLE "dm_requests" 
ADD COLUMN IF NOT EXISTS "closed_by_from_user_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "closed_by_to_user_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "from_user_rating" INTEGER,
ADD COLUMN IF NOT EXISTS "thread_id" UUID,
ADD COLUMN IF NOT EXISTS "to_user_rating" INTEGER;

-- AlterTable (column already added in previous migration, skipping)
-- ALTER TABLE "dm_threads" ADD COLUMN "is_support_thread" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_request_reports" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_request_reports_request_id_idx" ON "support_request_reports"("request_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_request_reports_reporter_id_idx" ON "support_request_reports"("reporter_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dm_requests_from_user_id_to_user_id_idx" ON "dm_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dm_requests_thread_id_idx" ON "dm_requests"("thread_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dm_threads_is_support_thread_idx" ON "dm_threads"("is_support_thread");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_requests_thread_id_fkey'
  ) THEN
    ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_request_reports_request_id_fkey'
  ) THEN
    ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "dm_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_request_reports_reporter_id_fkey'
  ) THEN
    ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
