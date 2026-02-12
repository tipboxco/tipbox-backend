-- Add new columns for simplified collection metadata
ALTER TABLE "badge_collections" ADD COLUMN IF NOT EXISTS "focus_sector" TEXT;
ALTER TABLE "badge_collections" ADD COLUMN IF NOT EXISTS "target_group" TEXT;
ALTER TABLE "badge_collections" ADD COLUMN IF NOT EXISTS "short_description" TEXT;
ALTER TABLE "badge_collections" ADD COLUMN IF NOT EXISTS "long_description" TEXT;

-- Copy data from old columns to new (one-time migration for existing rows)
UPDATE "badge_collections"
SET
  "long_description" = COALESCE("long_description", "collection_objective"),
  "focus_sector" = COALESCE("focus_sector", "target_vertical"),
  "target_group" = COALESCE("target_group", "target_audience"),
  "short_description" = COALESCE("short_description", "hook_pitch")
WHERE "collection_objective" IS NOT NULL
   OR "target_vertical" IS NOT NULL
   OR "target_audience" IS NOT NULL
   OR "hook_pitch" IS NOT NULL;

-- Make category_id nullable
ALTER TABLE "badge_collections" ALTER COLUMN "category_id" DROP NOT NULL;

-- Drop removed columns
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "collection_objective";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "target_vertical";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "product_scope";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "collection_type";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "hook_pitch";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "visual_theme";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "primary_kpi";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "secondary_kpi";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "target_audience";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "campaign_context";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "success_metric";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "sponsorship";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "schedule_launch_date";
ALTER TABLE "badge_collections" DROP COLUMN IF EXISTS "time_stock_limit";
