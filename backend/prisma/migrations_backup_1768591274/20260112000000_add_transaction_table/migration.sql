-- CreateEnum
CREATE TYPE "transaction_action_type" AS ENUM ('TIP_SEND', 'TIP_RECEIVE', 'CLAIM_REWARD', 'CLAIM_BADGE', 'NFT_BUY', 'NFT_SELL', 'SWAP_TIP_TO_SOL', 'SWAP_SOL_TO_TIP', 'AIRDROP', 'FEE');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('created', 'pending', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "action_type" "transaction_action_type" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'created',
    "amount" DOUBLE PRECISION,
    "from_address" TEXT,
    "to_address" TEXT,
    "metadata" JSONB,
    "tx_hash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'backend',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_wallet_id_idx" ON "transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_action_type_idx" ON "transactions"("action_type");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_status_idx" ON "transactions"("wallet_id", "status");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

