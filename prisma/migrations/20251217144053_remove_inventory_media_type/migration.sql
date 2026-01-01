-- DropIndex
DROP INDEX IF EXISTS "inventory_media_inventoryId_type_idx";

-- AlterTable
ALTER TABLE "inventory_media" DROP COLUMN IF EXISTS "type";

-- DropEnum
DROP TYPE IF EXISTS "inventory_media_type";
