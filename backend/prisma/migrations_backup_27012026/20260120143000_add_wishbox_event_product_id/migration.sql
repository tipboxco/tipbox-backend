-- Add optional product relation for WishboxEvent (Roasts)
-- Schema merged into 20260123121735_initialize (wishbox_events created with product_id).
-- This migration runs before initialize; no-op when table does not exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishbox_events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wishbox_events' AND column_name = 'product_id') THEN
      ALTER TABLE "wishbox_events" ADD COLUMN "product_id" TEXT;
      CREATE INDEX IF NOT EXISTS "wishbox_events_product_id_idx" ON "wishbox_events" ("product_id");
      ALTER TABLE "wishbox_events" ADD CONSTRAINT "wishbox_events_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
