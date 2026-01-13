export type ModuleType = "product" | "category" | "brand" | "brand_category"
export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface SyncConfigDTO {
  id: string
  name: string
  module_type: ModuleType
  target_url: string
  secret_token?: string | null
  batch_size: number
  is_active: boolean
  last_sync_at?: Date | null
  metadata?: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateSyncConfigInput {
  name: string
  module_type: ModuleType
  target_url: string
  secret_token?: string
  batch_size?: number
  is_active?: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateSyncConfigInput {
  name?: string
  module_type?: ModuleType
  target_url?: string
  secret_token?: string | null
  batch_size?: number
  is_active?: boolean
  metadata?: Record<string, unknown> | null
}

export interface SyncJobDTO {
  id: string
  sync_config_id: string
  status: SyncJobStatus
  total_records: number
  processed_records: number
  failed_records: number
  current_batch: number
  total_batches: number
  started_at?: Date | null
  completed_at?: Date | null
  error_message?: string | null
  metadata?: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateSyncJobInput {
  sync_config_id: string
  total_records?: number
  total_batches?: number
  metadata?: Record<string, unknown>
}

export interface UpdateSyncJobInput {
  status?: SyncJobStatus
  processed_records?: number
  failed_records?: number
  current_batch?: number
  started_at?: Date
  completed_at?: Date
  error_message?: string
  metadata?: Record<string, unknown>
}

export interface SyncPayload {
  sync_id: string
  job_id: string
  module_type: ModuleType
  batch_number: number
  total_batches: number
  batch_size: number
  total_records: number
  data: unknown[]
  timestamp: string
}

export interface SyncResult {
  success: boolean
  processed: number
  failed: number
  errors?: string[]
}

export interface BatchResult {
  batch_number: number
  success: boolean
  status_code?: number
  processed: number
  failed: number
  duration_ms: number
  error?: string
}

