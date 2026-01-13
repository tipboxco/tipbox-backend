-- Add cosmetic_badge_id column to profiles table
-- Note: This column is also added in the next migration (20251125114155_update_schema_with_new_models)
-- This migration ensures the column exists even if the next migration hasn't run yet
-- Using IF NOT EXISTS to prevent errors if column already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'cosmetic_badge_id'
    ) THEN
        ALTER TABLE "profiles" ADD COLUMN "cosmetic_badge_id" UUID;
    END IF;
END $$;