-- Allow multiple support threads between the same user pair
-- Each support request should have its own unique support thread
ALTER TABLE "dm_threads"
DROP CONSTRAINT IF EXISTS "dm_threads_user_one_id_user_two_id_is_support_thread_key";

