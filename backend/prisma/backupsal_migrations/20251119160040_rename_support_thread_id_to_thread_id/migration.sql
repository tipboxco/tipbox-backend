-- Rename support_thread_id to thread_id in dm_requests table
ALTER TABLE "dm_requests" 
RENAME COLUMN "support_thread_id" TO "thread_id";

-- Rename foreign key constraint
ALTER TABLE "dm_requests" 
RENAME CONSTRAINT "dm_requests_support_thread_id_fkey" TO "dm_requests_thread_id_fkey";

-- Create index on thread_id if it doesn't exist
CREATE INDEX IF NOT EXISTS "dm_requests_thread_id_idx" ON "dm_requests"("thread_id");



