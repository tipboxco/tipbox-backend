-- CreateTable
CREATE TABLE "support_request_reports" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_request_reports_request_id_idx" ON "support_request_reports"("request_id");

-- CreateIndex
CREATE INDEX "support_request_reports_reporter_id_idx" ON "support_request_reports"("reporter_id");

-- AddForeignKey
ALTER TABLE "support_request_reports"
ADD CONSTRAINT "support_request_reports_request_id_fkey"
FOREIGN KEY ("request_id") REFERENCES "dm_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request_reports"
ADD CONSTRAINT "support_request_reports_reporter_id_fkey"
FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

