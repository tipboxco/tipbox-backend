-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "gamification_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "expert_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "event_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "system_notifications" BOOLEAN NOT NULL DEFAULT true;
