-- Allow multiple support requests between the same user pair
-- Drop unique INDEX (not constraint - PostgreSQL creates unique indexes for unique constraints)
DROP INDEX IF EXISTS "dm_requests_from_user_id_to_user_id_key";

-- Add non-unique index for query performance
CREATE INDEX IF NOT EXISTS "dm_requests_from_user_id_to_user_id_idx"
ON "dm_requests" ("from_user_id", "to_user_id");

