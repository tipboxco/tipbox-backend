-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "smart_account_address" TEXT;

-- CreateIndex
CREATE INDEX "wallets_smart_account_address_idx" ON "wallets"("smart_account_address");
