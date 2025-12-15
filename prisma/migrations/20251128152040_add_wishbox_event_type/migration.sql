/*
  Warnings:

  - You are about to drop the column `category_id` on the `brands` table. All the data in the column will be lost.
  - You are about to drop the `brand_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "wishbox_event_type" AS ENUM ('SURVEY', 'POLL', 'CONTEST', 'CHALLENGE', 'PROMOTION');

-- DropForeignKey
ALTER TABLE "brands" DROP CONSTRAINT "brands_category_id_fkey";

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "category_id";

-- AlterTable
ALTER TABLE "wishbox_events" ADD COLUMN     "event_type" "wishbox_event_type" NOT NULL DEFAULT 'SURVEY';

-- DropTable
DROP TABLE "brand_categories";
