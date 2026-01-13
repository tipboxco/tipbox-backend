import { model } from "@medusajs/framework/utils"

/**
 * SyncJob - Sync job'larının durumunu takip eder
 */
export const SyncJob = model.define("sync_job", {
  id: model.id().primaryKey(),
  sync_config_id: model.text().index(),
  status: model.enum(["pending", "running", "completed", "failed", "cancelled"]).default("pending"),
  total_records: model.number().default(0),
  processed_records: model.number().default(0),
  failed_records: model.number().default(0),
  current_batch: model.number().default(0),
  total_batches: model.number().default(0),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  error_message: model.text().nullable(),
  metadata: model.json().nullable(),
})

