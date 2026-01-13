import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * POST /test/sync-receiver
 * Sync batch test endpoint - gelen bulk sync verilerini simüle eder
 * 
 * Beklenen Headers:
 * - Content-Type: application/json
 * - X-Sync-Secret: <secret_token> (opsiyonel)
 * - X-Sync-Id: <sync_config_id>
 * - X-Sync-Job-Id: <job_id>
 * 
 * Beklenen Body (SyncPayload):
 * {
 *   "sync_id": "sync_01ABC...",
 *   "job_id": "job_01XYZ...",
 *   "module_type": "product" | "category" | "brand",
 *   "batch_number": 1,
 *   "total_batches": 10,
 *   "batch_size": 100,
 *   "total_records": 1000,
 *   "data": [ ... array of records ... ],
 *   "timestamp": "2026-01-10T12:00:00.000Z"
 * }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startTime = Date.now()
  
  try {
    // Headers'ı al
    const headers = {
      contentType: req.headers["content-type"],
      syncSecret: req.headers["x-sync-secret"],
      syncId: req.headers["x-sync-id"],
      syncJobId: req.headers["x-sync-job-id"],
    }
    
    // Body'yi al
    const body = req.body as SyncPayload
    
    // Simülasyon: Secret token doğrulama
    const expectedSecret = "test-sync-secret-456" // Test için sabit secret
    const isSecretValid = !headers.syncSecret || headers.syncSecret === expectedSecret
    
    if (!isSecretValid) {
      console.log("[Sync Receiver] ❌ Invalid secret token")
      return res.status(401).json({
        success: false,
        error: "Invalid secret token",
        received_at: new Date().toISOString(),
      })
    }
    
    // Veri validasyonu
    if (!body.data || !Array.isArray(body.data)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payload: 'data' must be an array",
        received_at: new Date().toISOString(),
      })
    }
    
    // Simülasyon: Batch'i işle
    const result = processSyncBatch(body)
    
    const processingTime = Date.now() - startTime
    
    // Log
    console.log("[Sync Receiver] ✅ Batch received:", {
      moduleType: body.module_type,
      batch: `${body.batch_number}/${body.total_batches}`,
      records: body.data.length,
      processingTime: `${processingTime}ms`,
    })
    
    // Başarılı response - SyncManager'ın beklediği format
    res.status(200).json({
      success: true,
      message: `Batch ${body.batch_number}/${body.total_batches} processed successfully`,
      received_at: new Date().toISOString(),
      processing_time_ms: processingTime,
      
      // SyncManager'ın beklediği alanlar
      processed: result.processed,
      failed: result.failed,
      
      // Detaylı bilgi
      batch_summary: {
        sync_id: body.sync_id,
        job_id: body.job_id,
        module_type: body.module_type,
        batch_number: body.batch_number,
        total_batches: body.total_batches,
        records_in_batch: body.data.length,
        total_records: body.total_records,
      },
      
      // İşlenen kayıtların özeti
      processed_records: result.records,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Sync Receiver] ❌ Error:", message)
    
    res.status(500).json({
      success: false,
      error: message,
      processed: 0,
      failed: 0,
      received_at: new Date().toISOString(),
    })
  }
}

interface SyncPayload {
  sync_id: string
  job_id: string
  module_type: "product" | "category" | "brand"
  batch_number: number
  total_batches: number
  batch_size: number
  total_records: number
  data: Record<string, unknown>[]
  timestamp: string
}

interface ProcessResult {
  processed: number
  failed: number
  records: ProcessedRecord[]
}

interface ProcessedRecord {
  id: string
  status: "success" | "failed"
  action: string
  error?: string
}

/**
 * Sync batch'ini işler (simülasyon)
 */
function processSyncBatch(payload: SyncPayload): ProcessResult {
  const { module_type, data } = payload
  
  const records: ProcessedRecord[] = []
  let processed = 0
  let failed = 0
  
  for (const record of data) {
    const id = (record.id as string) || `unknown_${Math.random().toString(36).slice(2)}`
    
    // %95 başarı oranı simülasyonu (rastgele bazı kayıtları fail et)
    const isSuccess = Math.random() > 0.05
    
    if (isSuccess) {
      processed++
      records.push({
        id,
        status: "success",
        action: getUpsertAction(module_type, record),
      })
    } else {
      failed++
      records.push({
        id,
        status: "failed",
        action: getUpsertAction(module_type, record),
        error: "Simulated random failure for testing",
      })
    }
  }
  
  return { processed, failed, records }
}

/**
 * Modül tipine göre upsert action string'i döndürür
 */
function getUpsertAction(moduleType: string, record: Record<string, unknown>): string {
  const id = record.id || "?"
  
  switch (moduleType) {
    case "product":
      return `UPSERT product: ${id} - ${record.title || record.name || "Untitled"}`
    case "category":
      return `UPSERT category: ${id} - ${record.name || "Unnamed"}`
    case "brand":
      return `UPSERT brand: ${id} - ${record.name || "Unnamed"}`
    default:
      return `UPSERT ${moduleType}: ${id}`
  }
}

// GET - Endpoint durumunu kontrol
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json({
    status: "ready",
    endpoint: "/test/sync-receiver",
    description: "Sync batch receiver test endpoint",
    expected_payload: {
      sync_id: "string",
      job_id: "string",
      module_type: "product | category | brand",
      batch_number: "number",
      total_batches: "number",
      batch_size: "number",
      total_records: "number",
      data: "array of records",
      timestamp: "ISO date string",
    },
    expected_headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": "optional - secret token",
      "X-Sync-Id": "optional - sync config id",
      "X-Sync-Job-Id": "optional - job id",
    },
  })
}

// OPTIONS for CORS
export const OPTIONS = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sync-Secret, X-Sync-Id, X-Sync-Job-Id")
  res.status(204).end()
}

