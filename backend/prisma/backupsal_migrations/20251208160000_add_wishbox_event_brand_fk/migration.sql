-- Ensure wishbox_events has brand relation aligned with Prisma schema
ALTER TABLE "wishbox_events"
ADD COLUMN IF NOT EXISTS "brand_id" UUID;

-- Add FK to brands (cascade delete aligns with Prisma onDelete: Cascade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'wishbox_events_brand_id_fkey'
      AND tc.table_name = 'wishbox_events'
  ) THEN
    ALTER TABLE "wishbox_events"
    ADD CONSTRAINT "wishbox_events_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index for faster brand filtering
CREATE INDEX IF NOT EXISTS "wishbox_events_brand_id_idx"
ON "wishbox_events"("brand_id");















