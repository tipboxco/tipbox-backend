-- CreateTable
CREATE TABLE "user_reports" (
    "id" UUID NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_reports_reported_user_id_idx" ON "user_reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "user_reports_reporter_id_idx" ON "user_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "user_reports_category_idx" ON "user_reports"("category");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "user_reports_reporter_id_reported_user_id_key" ON "user_reports"("reporter_id", "reported_user_id");

-- AddForeignKey
ALTER TABLE "user_reports"
ADD CONSTRAINT "user_reports_reported_user_id_fkey"
FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports"
ADD CONSTRAINT "user_reports_reporter_id_fkey"
FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

