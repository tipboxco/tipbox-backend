import { model } from "@medusajs/framework/utils"

export const WebhookLog = model.define("webhook_log", {
  id: model.id().primaryKey(),
  webhook_id: model.text().index(),
  event_name: model.text(),
  target_url: model.text(),
  status: model.enum(["success", "failed", "pending"]).default("pending"),
  status_code: model.number().nullable(),
  request_body: model.json().nullable(),
  response_body: model.text().nullable(),
  error_message: model.text().nullable(),
  duration_ms: model.number().nullable(),
  triggered_at: model.dateTime(),
})

