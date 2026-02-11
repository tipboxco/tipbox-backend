-- AlterTable
ALTER TABLE "nfts" ADD COLUMN IF NOT EXISTS "token_id" TEXT;
ALTER TABLE "nfts" ADD COLUMN IF NOT EXISTS "contract_address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "nfts_token_id_contract_address_key" ON "nfts"("token_id", "contract_address") WHERE "token_id" IS NOT NULL AND "contract_address" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "nfts_token_id_contract_address_idx" ON "nfts"("token_id", "contract_address");
