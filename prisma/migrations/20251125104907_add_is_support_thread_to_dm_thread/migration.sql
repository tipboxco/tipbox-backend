-- CreateEnum
CREATE TYPE "DMMessageContext" AS ENUM ('DM', 'SUPPORT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "dm_request_status" ADD VALUE 'CANCELED';
ALTER TYPE "dm_request_status" ADD VALUE 'AWAITING_COMPLETION';
ALTER TYPE "dm_request_status" ADD VALUE 'COMPLETED';

-- DropIndex
DROP INDEX "dm_requests_from_user_id_to_user_id_key";

-- DropIndex
DROP INDEX "dm_threads_user_one_id_user_two_id_key";

-- AlterTable
ALTER TABLE "dm_messages" ADD COLUMN     "context" "DMMessageContext" NOT NULL DEFAULT 'DM';

-- AlterTable
ALTER TABLE "dm_requests" ADD COLUMN     "closed_by_from_user_at" TIMESTAMP(3),
ADD COLUMN     "closed_by_to_user_at" TIMESTAMP(3),
ADD COLUMN     "from_user_rating" INTEGER,
ADD COLUMN     "thread_id" UUID,
ADD COLUMN     "to_user_rating" INTEGER;

-- AlterTable
ALTER TABLE "dm_threads" ADD COLUMN     "is_support_thread" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "support_request_reports" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_request_reports_request_id_idx" ON "support_request_reports"("request_id");

-- CreateIndex
CREATE INDEX "support_request_reports_reporter_id_idx" ON "support_request_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "dm_requests_from_user_id_to_user_id_idx" ON "dm_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE INDEX "dm_requests_thread_id_idx" ON "dm_requests"("thread_id");

-- CreateIndex
CREATE INDEX "dm_threads_is_support_thread_idx" ON "dm_threads"("is_support_thread");

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "dm_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request_reports" ADD CONSTRAINT "support_request_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
