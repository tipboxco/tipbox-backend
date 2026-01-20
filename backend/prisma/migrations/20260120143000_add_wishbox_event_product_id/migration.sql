-- Add optional product relation for WishboxEvent (Roasts)

ALTER TABLE "wishbox_events"
ADD COLUMN "product_id" text;

CREATE INDEX IF NOT EXISTS "wishbox_events_product_id_idx" ON "wishbox_events" ("product_id");

ALTER TABLE "wishbox_events"
ADD CONSTRAINT "wishbox_events_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products" ("id")
ON DELETE SET NULL ON UPDATE CASCADE;

