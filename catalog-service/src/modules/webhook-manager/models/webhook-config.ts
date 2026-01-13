import { model } from "@medusajs/framework/utils"

export const WebhookConfig = model.define("webhook_config", {
  id: model.id().primaryKey(),
  event_names: model.json(),
  target_url: model.text(),
  secret_token: model.text().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

