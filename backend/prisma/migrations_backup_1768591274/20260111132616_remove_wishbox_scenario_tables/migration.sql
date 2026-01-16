/*
  Warnings:

  - You are about to drop the `choice_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scenario_choices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wishbox_scenarios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "choice_comments" DROP CONSTRAINT "choice_comments_choice_id_fkey";

-- DropForeignKey
ALTER TABLE "choice_comments" DROP CONSTRAINT "choice_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_choices" DROP CONSTRAINT "scenario_choices_scenario_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_choices" DROP CONSTRAINT "scenario_choices_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_scenarios" DROP CONSTRAINT "wishbox_scenarios_event_id_fkey";

-- DropTable
DROP TABLE "choice_comments";

-- DropTable
DROP TABLE "scenario_choices";

-- DropTable
DROP TABLE "wishbox_scenarios";
