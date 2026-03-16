-- Add missing POST action types (FREE, QUESTION, COMPARE, UPDATE, BENCHMARK)
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'POST', 'FREE', 'Free Post', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'POST' AND "code" = 'FREE'
);

INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'POST', 'QUESTION', 'Question Post', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'POST' AND "code" = 'QUESTION'
);

INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'POST', 'COMPARE', 'Compare Post', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'POST' AND "code" = 'COMPARE'
);

INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'POST', 'UPDATE', 'Update Post', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'POST' AND "code" = 'UPDATE'
);

INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'POST', 'BENCHMARK', 'Benchmark Post', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'POST' AND "code" = 'BENCHMARK'
);

-- Add JOIN:EVENT action type
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'JOIN', 'EVENT', 'Join Event', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'JOIN' AND "code" = 'EVENT'
);

-- Add inventory status-specific action types (OWN, TRIED)
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'SYSTEM', 'INVENTORY_OWN', 'Add Owned Product to Inventory', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'SYSTEM' AND "code" = 'INVENTORY_OWN'
);

INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
SELECT gen_random_uuid(), 'SYSTEM', 'INVENTORY_TRIED', 'Add Tried Product to Inventory', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "action_types" WHERE "main_action" = 'SYSTEM' AND "code" = 'INVENTORY_TRIED'
);
