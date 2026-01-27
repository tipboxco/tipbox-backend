-- Add feed_type to wishbox_events for Picks/Roasts separation

-- Create enum type
CREATE TYPE "wishbox_event_feed_type" AS ENUM ('PICKS', 'ROASTS');

-- Add column with default
ALTER TABLE "wishbox_events"
ADD COLUMN "feed_type" "wishbox_event_feed_type" NOT NULL DEFAULT 'PICKS';

