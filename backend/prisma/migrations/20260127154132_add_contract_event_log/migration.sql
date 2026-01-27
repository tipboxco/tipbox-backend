-- CreateTable
CREATE TABLE "contract_event_logs" (
    "id" UUID NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "contract_address" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "transaction_hash" TEXT NOT NULL,
    "transaction_index" INTEGER NOT NULL,
    "log_index" INTEGER NOT NULL,
    "event_name" TEXT NOT NULL,
    "decoded_log" JSONB NOT NULL,
    "topics" TEXT[],
    "data" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "transaction_id" UUID,
    "wallet_id" UUID,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_event_logs_contract_address_idx" ON "contract_event_logs"("contract_address");

-- CreateIndex
CREATE INDEX "contract_event_logs_event_name_idx" ON "contract_event_logs"("event_name");

-- CreateIndex
CREATE INDEX "contract_event_logs_transaction_hash_idx" ON "contract_event_logs"("transaction_hash");

-- CreateIndex
CREATE INDEX "contract_event_logs_block_number_idx" ON "contract_event_logs"("block_number");

-- CreateIndex
CREATE INDEX "contract_event_logs_chain_id_contract_address_idx" ON "contract_event_logs"("chain_id", "contract_address");

-- CreateIndex
CREATE INDEX "contract_event_logs_wallet_id_idx" ON "contract_event_logs"("wallet_id");

-- CreateIndex
CREATE INDEX "contract_event_logs_processed_idx" ON "contract_event_logs"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "contract_event_logs_transaction_hash_log_index_key" ON "contract_event_logs"("transaction_hash", "log_index");

-- AddForeignKey
ALTER TABLE "contract_event_logs" ADD CONSTRAINT "contract_event_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_event_logs" ADD CONSTRAINT "contract_event_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
