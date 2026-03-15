-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_system_user" BOOLEAN NOT NULL DEFAULT false;

-- Set admin@tipbox.co as system user
UPDATE "users" SET "is_system_user" = true WHERE "email" = 'admin@tipbox.co';

-- CreateIndex (performance for filtering)
CREATE INDEX "users_is_system_user_idx" ON "users"("is_system_user");
