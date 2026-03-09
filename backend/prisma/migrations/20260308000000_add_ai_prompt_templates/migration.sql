-- CreateTable
CREATE TABLE "ai_prompt_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt_text" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_key_key" ON "ai_prompt_templates"("key");

-- CreateIndex
CREATE INDEX "ai_prompt_templates_key_idx" ON "ai_prompt_templates"("key");

-- CreateIndex
CREATE INDEX "ai_prompt_templates_is_active_idx" ON "ai_prompt_templates"("is_active");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_template_key_idx" ON "ai_prompt_versions"("template_key");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_created_at_idx" ON "ai_prompt_versions"("created_at");

-- Seed: Experience Split Prompt (v1.0)
INSERT INTO "ai_prompt_templates" ("id", "key", "name", "description", "prompt_text", "version", "is_active", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'split-experience',
  'Experience Split Prompt',
  'Splits user product experience text into Price/Shopping and Product/Usage categories with content standardization, rating, and placeholder generation.',
  E'You have a user''s product experience text. Analyze it and split it into two categories while standardizing the content:\n\n1. **Price and Shopping Experience**\n   - Product price, purchase process, delivery, shipping, packaging\n   - Payment options, discounts, campaigns\n   - Seller experience, customer service\n\n2. **Product and Usage Experience**\n   - Product performance, quality, features\n   - Usage experience, durability\n   - Whether the product meets expectations\n\n{{PRODUCT_INFO}}\n\nUser Experience:\n\"\"\"\n{{EXPERIENCE_TEXT}}\n\"\"\"\n\nCRITICAL RULES:\n\n1. **CONTENT STANDARDIZATION:**\n   - Transform short and concise texts into more meaningful and proper sentences according to the category standard\n   - Fix slang, rude, or careless expressions\n   - Restate the text in a professional but friendly tone\n   - Complete missing contexts while preserving meaning\n\n2. **CATEGORY SEPARATION:**\n   - Read the text carefully and separate ONLY the information belonging to the relevant category\n   - NEVER copy the same text to both categories - this is strictly forbidden!\n   - If the text belongs to only one category, make the other category null\n   - Give a rating between 1-5 for each category\n\n3. **PLACEHOLDER GENERATION:**\n   - If there is NO information for a category, make that category null\n   - If information EXISTS BUT IS INCOMPLETE for a category, generate a dynamic placeholder\n   - The placeholder should guide the user to fill in the missing parts of that category\n   - Placeholder examples:\n     * If price info exists but no delivery: \"Also tell us about the delivery process and packaging quality...\"\n     * If product info exists but no usage duration: \"How long have you been using it? Tell us about long-term performance...\"\n     * If price info exists but no purchase location: \"Where did you buy it? How was your seller experience?\"\n\nEXAMPLES:\n\nExample 1 - Short Price Text (Enhancement + Placeholder):\nInput: \"I found it very expensive, paid 18,000 TL.\"\nOutput:\n```json\n{\n  \"priceAndShopping\": {\n    \"content\": \"I purchased the product for 18,000 TL and found the price quite high.\",\n    \"rating\": 2,\n    \"placeholder\": \"Also add information about the delivery process, payment options, or your seller experience...\"\n  },\n  \"productAndUsage\": null\n}\n```\n\nExample 2 - Short Product Text (Enhancement + Placeholder):\nInput: \"Battery life is bad.\"\nOutput:\n```json\n{\n  \"priceAndShopping\": null,\n  \"productAndUsage\": {\n    \"content\": \"The product''s battery life did not meet my expectations and I found it insufficient.\",\n    \"rating\": 2,\n    \"placeholder\": \"Also tell us about the product''s other features, performance, or your usage experience...\"\n  }\n}\n```\n\nExample 3 - Delivery Only (Enhancement + Placeholder):\nInput: \"Shipping was very fast, arrived in 2 days.\"\nOutput:\n```json\n{\n  \"priceAndShopping\": {\n    \"content\": \"The product delivery was quite fast, it arrived just 2 days after placing the order.\",\n    \"rating\": 5,\n    \"placeholder\": \"Also tell us about the product''s price, purchase process, or packaging quality...\"\n  },\n  \"productAndUsage\": null\n}\n```\n\nExample 4 - Comprehensive Text (Both Categories Complete):\nInput: \"Bought from Dyson for 949 TL. Delivery was fast. Product is great, laser technology is amazing. Battery lasts 60 minutes, I can easily clean my house.\"\nOutput:\n```json\n{\n  \"priceAndShopping\": {\n    \"content\": \"I purchased the product from Dyson for 949 TL and the delivery process was quite fast.\",\n    \"rating\": 5\n  },\n  \"productAndUsage\": {\n    \"content\": \"I am very satisfied with the product''s performance. The green laser technology is particularly effective. The battery life lasts about 60 minutes in normal mode, so I can easily clean my house on a single charge.\",\n    \"rating\": 5\n  }\n}\n```\n\nIMPORTANT:\n- Standardize content but do not change the meaning\n- Make short texts more meaningful\n- Generate dynamic placeholders for incomplete categories\n- Do not add placeholders for complete categories\n\nPlease respond in the following JSON format:\n\n```json\n{\n  \"priceAndShopping\": {\n    \"content\": \"...\",\n    \"rating\": 1-5,\n    \"placeholder\": \"...\" (optional, only if category is incomplete)\n  } | null,\n  \"productAndUsage\": {\n    \"content\": \"...\",\n    \"rating\": 1-5,\n    \"placeholder\": \"...\" (optional, only if category is incomplete)\n  } | null\n}\n```',
  'v1.0',
  true,
  NOW(),
  NOW()
) ON CONFLICT ("key") DO NOTHING;

INSERT INTO "ai_prompt_versions" ("id", "template_key", "version", "prompt_text", "change_note", "created_at")
SELECT
  gen_random_uuid(),
  'split-experience',
  'v1.0',
  t."prompt_text",
  'Initial version - migrated from hardcoded prompt',
  NOW()
FROM "ai_prompt_templates" t
WHERE t."key" = 'split-experience'
  AND NOT EXISTS (
    SELECT 1 FROM "ai_prompt_versions" v
    WHERE v."template_key" = 'split-experience' AND v."version" = 'v1.0'
  );
