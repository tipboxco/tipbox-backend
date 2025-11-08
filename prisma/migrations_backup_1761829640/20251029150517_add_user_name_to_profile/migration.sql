-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "user_name" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_name_key" ON "profiles"("user_name");

