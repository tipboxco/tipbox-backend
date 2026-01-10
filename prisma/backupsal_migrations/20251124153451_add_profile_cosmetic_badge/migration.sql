-- AlterEnum
ALTER TYPE "dm_request_status" ADD VALUE 'REPORTED';

-- CreateIndex
CREATE INDEX "dm_threads_is_support_thread_idx" ON "dm_threads"("is_support_thread");
