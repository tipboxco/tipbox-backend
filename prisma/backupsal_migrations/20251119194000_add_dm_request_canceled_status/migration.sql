DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dm_request_status' AND e.enumlabel = 'CANCELED'
  ) THEN
    ALTER TYPE "dm_request_status" ADD VALUE 'CANCELED';
  END IF;
END
$$;
