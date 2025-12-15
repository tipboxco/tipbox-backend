-- Alter dm_requests to store support thread reference
ALTER TABLE "dm_requests"
ADD COLUMN "support_thread_id" UUID;

ALTER TABLE "dm_requests"
ADD CONSTRAINT "dm_requests_support_thread_id_fkey"
FOREIGN KEY ("support_thread_id") REFERENCES "dm_threads" ("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend dm_threads to flag support conversations
ALTER TABLE "dm_threads"
ADD COLUMN "is_support_thread" BOOLEAN NOT NULL DEFAULT FALSE;

-- Update unique constraint to account for support threads
ALTER TABLE "dm_threads"
DROP CONSTRAINT IF EXISTS "dm_threads_user_one_id_user_two_id_key";

ALTER TABLE "dm_threads"
ADD CONSTRAINT "dm_threads_user_one_id_user_two_id_is_support_thread_key"
UNIQUE ("user_one_id", "user_two_id", "is_support_thread");
