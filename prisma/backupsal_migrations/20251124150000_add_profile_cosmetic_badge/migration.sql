-- Add cosmetic badge relation to profiles
ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "cosmetic_badge_id" UUID;

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_cosmetic_badge_id_fkey"
FOREIGN KEY ("cosmetic_badge_id") REFERENCES "badges"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
































