-- Migration: Add email verification support
-- Created: Add emailVerified field to users table and email_verification_codes table

-- AlterTable: Add emailVerified column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: EmailVerificationCode
CREATE TABLE IF NOT EXISTS "email_verification_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: userId and code
CREATE INDEX IF NOT EXISTS "email_verification_codes_user_id_code_idx" ON "email_verification_codes"("user_id", "code");

-- CreateIndex: email and code
CREATE INDEX IF NOT EXISTS "email_verification_codes_email_code_idx" ON "email_verification_codes"("email", "code");

-- AddForeignKey: User relation
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

