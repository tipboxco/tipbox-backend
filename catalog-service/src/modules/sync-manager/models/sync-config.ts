import { model } from "@medusajs/framework/utils"

/**
 * SyncConfig - Sync konfigürasyonu
 * Hangi modülün hangi endpoint'e sync edileceğini tanımlar
 */
export const SyncConfig = model.define("sync_config", {
  id: model.id().primaryKey(),
  name: model.text().searchable(),
  module_type: model.enum(["product", "category", "brand", "brand_category", "backend_seed"]),
  target_url: model.text(),
  secret_token: model.text().nullable(),
  batch_size: model.number().default(1000),
  is_active: model.boolean().default(true),
  last_sync_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

