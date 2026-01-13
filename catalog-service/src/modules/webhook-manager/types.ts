export interface WebhookConfigDTO {
  id: string
  event_names: string[]
  target_url: string
  secret_token?: string | null
  is_active: boolean
  metadata?: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateWebhookConfigInput {
  event_names: string[]
  target_url: string
  secret_token?: string
  is_active?: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateWebhookConfigInput {
  event_names?: string[]
  target_url?: string
  secret_token?: string | null
  is_active?: boolean
  metadata?: Record<string, unknown> | null
}

export interface WebhookPayload {
  event: string
  data: unknown
  timestamp: string
  webhook_id: string
}

export interface WebhookDispatchResult {
  webhook_id: string
  target_url: string
  success: boolean
  status_code?: number
  error?: string
  duration_ms?: number
}

export type WebhookLogStatus = "success" | "failed" | "pending"

export interface WebhookLogDTO {
  id: string
  webhook_id: string
  event_name: string
  target_url: string
  status: WebhookLogStatus
  status_code?: number | null
  request_body?: Record<string, unknown> | null
  response_body?: string | null
  error_message?: string | null
  duration_ms?: number | null
  triggered_at: Date
  created_at: Date
}

export interface CreateWebhookLogInput {
  webhook_id: string
  event_name: string
  target_url: string
  status: WebhookLogStatus
  status_code?: number
  request_body?: Record<string, unknown>
  response_body?: string
  error_message?: string
  duration_ms?: number
  triggered_at: Date
}

