-- Extend `notification_type` enum with missing values used by the app.
-- Safe to run multiple times (duplicate values are ignored).

DO $$
BEGIN
  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'WALLET_CONNECTED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'WALLET_DISCONNECTED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'TRANSACTION_CONFIRMED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'TRANSACTION_FAILED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'TRANSACTION_PENDING';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'REWARD_CLAIMABLE';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'REWARD_CLAIMED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'REWARD_EXPIRED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'MULTIPLE_REWARDS_AVAILABLE';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_RECEIVED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_SENT';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_SOLD';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_PURCHASED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_LISTED';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "notification_type" ADD VALUE 'NFT_LISTING_SOLD';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

