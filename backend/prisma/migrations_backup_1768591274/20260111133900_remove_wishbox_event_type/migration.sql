/*
  Warnings:

  - You are about to drop the column `event_type` on the `wishbox_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wishbox_events" DROP COLUMN "event_type";

-- DropEnum
DROP TYPE "wishbox_event_type";
