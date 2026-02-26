-- Add feed_type to wishbox_events for Picks/Roasts separation
-- Schema merged into 20260123121735_initialize (wishbox_events created with feed_type + product_id).
-- This migration runs before initialize; no-op to avoid "relation wishbox_events does not exist".

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishbox_events') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wishbox_event_feed_type') THEN
      CREATE TYPE "wishbox_event_feed_type" AS ENUM ('PICKS', 'ROASTS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wishbox_events' AND column_name = 'feed_type') THEN
      ALTER TABLE "wishbox_events" ADD COLUMN "feed_type" "wishbox_event_feed_type" NOT NULL DEFAULT 'PICKS';
    END IF;
  END IF;
END $$;
