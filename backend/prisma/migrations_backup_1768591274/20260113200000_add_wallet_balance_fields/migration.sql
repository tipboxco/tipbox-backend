-- AlterTable: Add balance and lockedBalance fields to wallets table
ALTER TABLE "wallets" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN "locked_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex: Add index on userId for faster lookups
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex: Add index on balance for analytics queries
CREATE INDEX "wallets_balance_idx" ON "wallets"("balance");

-- Data Migration: Calculate and set initial balances for existing wallets
-- This will be done in a separate script after migration
