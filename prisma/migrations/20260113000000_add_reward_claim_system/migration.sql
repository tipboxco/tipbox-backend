-- CreateEnum
CREATE TYPE "reward_claim_type" AS ENUM ('TIPS', 'BADGE', 'ACHIEVEMENT', 'LADDER', 'SUPPORT', 'EVENT');

-- CreateEnum
CREATE TYPE "reward_source_type" AS ENUM ('LADDER_REWARD', 'TIPS_RECEIVED', 'SUPPORT_SESSION', 'BADGE_EARNED', 'ACHIEVEMENT_UNLOCKED', 'EVENT_PARTICIPATION', 'SYSTEM_GRANT');

-- CreateEnum
CREATE TYPE "reward_claim_status" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- Drop old reward_claims table if exists
DROP TABLE IF EXISTS "reward_claims" CASCADE;

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "reward_type" "reward_claim_type" NOT NULL,
    "source_type" "reward_source_type" NOT NULL,
    "source_id" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "reward_claim_status" NOT NULL DEFAULT 'PENDING',
    "claimed_at" TIMESTAMP(3),
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reward_claims_user_id_status_idx" ON "reward_claims"("user_id", "status");

-- CreateIndex
CREATE INDEX "reward_claims_user_id_earned_at_idx" ON "reward_claims"("user_id", "earned_at");

-- CreateIndex
CREATE INDEX "reward_claims_status_expires_at_idx" ON "reward_claims"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
