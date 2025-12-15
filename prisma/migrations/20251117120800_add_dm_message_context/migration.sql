-- CreateEnum
CREATE TYPE "dm_message_context" AS ENUM ('DM', 'SUPPORT');

-- AlterTable
ALTER TABLE "dm_messages"
ADD COLUMN "context" "dm_message_context" NOT NULL DEFAULT 'DM';

