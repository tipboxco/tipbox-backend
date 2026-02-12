-- Add boost_price to content_posts (TIPS amount paid when is_boosted = true)
ALTER TABLE "content_posts" ADD COLUMN IF NOT EXISTS "boost_price" DOUBLE PRECISION;

-- Add BOOST_POST to transaction_action_type enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BOOST_POST' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_action_type')) THEN
    ALTER TYPE "transaction_action_type" ADD VALUE 'BOOST_POST';
  END IF;
END $$;

-- CreateTable: badge_reminders (badge reminder notifications)
CREATE TABLE IF NOT EXISTS "badge_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "badge_reminders_user_id_idx" ON "badge_reminders"("user_id");
CREATE INDEX IF NOT EXISTS "badge_reminders_badge_id_idx" ON "badge_reminders"("badge_id");
CREATE INDEX IF NOT EXISTS "badge_reminders_remind_at_idx" ON "badge_reminders"("remind_at");

ALTER TABLE "badge_reminders" ADD CONSTRAINT "badge_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "badge_reminders" ADD CONSTRAINT "badge_reminders_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shared post in DM: message type for "share post to trust user" (card + text below)
ALTER TABLE "dm_messages" ADD COLUMN IF NOT EXISTS "shared_post_id" VARCHAR(26);
CREATE INDEX IF NOT EXISTS "dm_messages_shared_post_id_idx" ON "dm_messages"("shared_post_id");
