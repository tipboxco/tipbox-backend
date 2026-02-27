-- Rename Wishbox-related database objects to Event naming (Wishbox → Event migration)
-- Tables: wishbox_events → events, wishbox_stats → event_stats, wishbox_rewards → event_rewards
-- Enums: wishbox_event_status → event_status, wishbox_event_feed_type → event_feed_type, wishbox_reward_type → event_reward_type

-- 1. Rename enum types (columns using these types will automatically use the new type name)
ALTER TYPE "wishbox_event_status" RENAME TO "event_status";
ALTER TYPE "wishbox_event_feed_type" RENAME TO "event_feed_type";
ALTER TYPE "wishbox_reward_type" RENAME TO "event_reward_type";

-- 2. Rename tables (foreign key references are updated automatically by PostgreSQL)
ALTER TABLE "wishbox_events" RENAME TO "events";
ALTER TABLE "wishbox_stats" RENAME TO "event_stats";
ALTER TABLE "wishbox_rewards" RENAME TO "event_rewards";
