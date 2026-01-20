-- Add goal_type to achievement_goals (non-event ladder tracking)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'achievement_goal_type') THEN
    CREATE TYPE "achievement_goal_type" AS ENUM (
      'POST',
      'INVENTORY',
      'LIKE_GIVEN',
      'LIKE_RECEIVED',
      'COMMENT'
    );
  END IF;
END$$;

ALTER TABLE "achievement_goals"
ADD COLUMN IF NOT EXISTS "goal_type" "achievement_goal_type";

CREATE INDEX IF NOT EXISTS "achievement_goals_goal_type_idx" ON "achievement_goals" ("goal_type");

