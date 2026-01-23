/**
 * Sync Receiver DTO Definitions
 * Harici sistemlerden gelen batch sync verilerini tanımlar
 */

export type SyncModuleType = 'product' | 'category' | 'brand' | 'brand-categories';

export interface SyncPayload {
  sync_id: string;
  job_id: string;
  module_type: SyncModuleType;
  batch_number: number;
  total_batches: number;
  batch_size: number;
  total_records: number;
  data: SyncRecord[];
  timestamp: string;
}

export interface SyncRecord {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  handle?: string;
  thumbnail?: string;
  image_url?: string;
  logo_url?: string;
  banner_url?: string;
  website_url?: string;
  parent_id?: string;
  category_id?: string;
  category?: string | unknown;
  group_id?: string;
  brand?: string;
  sub_name?: string;
  rank?: number;
  ispopular?: boolean;
  is_active?: boolean;
  tags?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SyncHeaders {
  contentType: string | undefined;
  syncSecret: string | string[] | undefined;
  syncId: string | string[] | undefined;
  syncJobId: string | string[] | undefined;
}

export interface ProcessedRecord {
  id: string;
  status: 'success' | 'failed';
  action: 'created' | 'updated' | 'skipped';
  error?: string;
}

export interface ProcessResult {
  processed: number;
  failed: number;
  created: number;
  updated: number;
  records: ProcessedRecord[];
}

export interface SyncResponse {
  success: boolean;
  message: string;
  received_at: string;
  processing_time_ms: number;
  processed: number;
  failed: number;
  created: number;
  updated: number;
  batch_summary: {
    sync_id: string;
    job_id: string;
    module_type: SyncModuleType;
    batch_number: number;
    total_batches: number;
    records_in_batch: number;
    total_records: number;
  };
  processed_records?: ProcessedRecord[];
}

export interface SyncErrorResponse {
  success: false;
  error: string;
  processed: number;
  failed: number;
  received_at: string;
}

export interface SyncStatusResponse {
  status: 'ready';
  endpoint: string;
  description: string;
  expected_payload: {
    sync_id: string;
    job_id: string;
    module_type: string;
    batch_number: string;
    total_batches: string;
    batch_size: string;
    total_records: string;
    data: string;
    timestamp: string;
  };
  expected_headers: {
    'Content-Type': string;
    'X-Sync-Secret': string;
    'X-Sync-Id': string;
    'X-Sync-Job-Id': string;
  };
}

