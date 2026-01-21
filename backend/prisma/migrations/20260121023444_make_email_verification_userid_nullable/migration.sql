-- Migration: Make email_verification_codes.user_id nullable and add password_hash, name columns

-- Step 1: Drop the foreign key constraint
ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_user_id_fkey;

-- Step 2: Make user_id nullable
ALTER TABLE email_verification_codes ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Add password_hash column
ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Step 4: Add name column
ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS name TEXT;

-- Step 5: Re-add the foreign key constraint (nullable)
ALTER TABLE email_verification_codes 
ADD CONSTRAINT email_verification_codes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 6: Update index to handle nullable user_id
DROP INDEX IF EXISTS email_verification_codes_user_id_code_idx;
CREATE INDEX IF NOT EXISTS email_verification_codes_user_id_code_idx ON email_verification_codes(user_id, code) WHERE user_id IS NOT NULL;

