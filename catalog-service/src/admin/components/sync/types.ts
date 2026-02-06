export type ModuleType = "product" | "category" | "brand" | "brand_category" | "backend_seed"

export type BackendSeedItem = {
  id: string
  name: string
  relativePath: string
  /** Kaynak klasör: prisma/seed, scripts vb. */
  sourceDir?: string
  sync_config_id?: string
}

export type SyncStats = {
  total_jobs: number
  success_rate: number
  total_records_synced: number
  running_jobs: number
}

export type SyncConfig = {
  id: string
  name: string
  module_type: ModuleType
  target_url: string
  secret_token?: string | null
  batch_size: number
  is_active: boolean
  last_sync_at?: string | null
  stats?: SyncStats
}

export const MODULE_LABELS: Record<ModuleType, string> = {
  product: "Ürünler",
  category: "Kategoriler",
  brand: "Markalar",
  brand_category: "Marka Kategorileri",
  backend_seed: "Backend Seed",
}

export const MODULE_COLORS: Record<ModuleType, "blue" | "green" | "purple" | "orange"> = {
  product: "blue",
  category: "green",
  brand: "purple",
  brand_category: "purple",
  backend_seed: "orange",
}

export type LogLine = { type: "stdout" | "stderr"; line: string }

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export type SyncJob = {
  id: string
  sync_config_id?: string
  status: JobStatus
  total_records: number
  processed_records: number
  failed_records: number
  current_batch: number
  total_batches: number
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  created_at: string
  metadata?: { log_lines?: LogLine[]; exit_code?: number } | null
}

export const formatSyncDate = (d?: string | null) =>
  !d ? "Hiç" : new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export const formatSyncTime = (d?: string | null) =>
  !d ? "-" : new Date(d).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
