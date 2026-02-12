-- CreateTable: action_logs
CREATE TABLE "action_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "main_action" main_action NOT NULL,
    "action_type_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_logs_user_id_main_action_idx" ON "action_logs"("user_id", "main_action");
CREATE INDEX "action_logs_user_id_created_at_idx" ON "action_logs"("user_id", "created_at");
CREATE INDEX "action_logs_entity_type_entity_id_idx" ON "action_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_action_type_id_fkey" FOREIGN KEY ("action_type_id") REFERENCES "action_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add granular action types for future use
-- These are seeded here for future granular tracking (Phase 2+)
-- Note: SHARE MainAction not yet in enum, will be added in Phase 2
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'LIKE', 'POST', 'Like Post', NOW(), NOW()),
  (gen_random_uuid(), 'LIKE', 'COMMENT', 'Like Comment', NOW(), NOW()),
  (gen_random_uuid(), 'BOOKMARK', 'POST', 'Bookmark Post', NOW(), NOW()),
  (gen_random_uuid(), 'BOOKMARK', 'COLLECTION', 'Bookmark Collection', NOW(), NOW())
ON CONFLICT (main_action, code) DO NOTHING;
