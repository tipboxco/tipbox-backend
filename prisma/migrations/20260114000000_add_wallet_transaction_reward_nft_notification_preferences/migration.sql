-- AlterTable
ALTER TABLE "user_settings" 
ADD COLUMN "wallet_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "transaction_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reward_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "nft_notifications" BOOLEAN NOT NULL DEFAULT true;
