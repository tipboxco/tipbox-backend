import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * POST /test/webhook-receiver
 * Webhook test endpoint - gelen webhook event'ine göre Medusa'dan item detaylarını çeker
 * 
 * Beklenen Body:
 * {
 *   "event": "product.created",
 *   "timestamp": "2026-01-10T12:00:00.000Z",
 *   "webhook_id": "01KEK85G7NFCXSTEQT7MEC7DZJ",
 *   "data": {
 *     "id": "prod_01KEKCDW5CXTHA7AG5Y2B6FDN7",
 *     "metadata": { ... }
 *   }
 * }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startTime = Date.now()
  
  try {
    // Headers'ı al
    const headers = {
      contentType: req.headers["content-type"],
      webhookSecret: req.headers["x-webhook-secret"],
      webhookEvent: req.headers["x-webhook-event"],
    }
    
    // Body'yi al
    const body = req.body as WebhookPayload
    
    // Secret token doğrulama (opsiyonel)
    const expectedSecret = process.env.WEBHOOK_RECEIVER_SECRET || "test-secret-123"
    if (headers.webhookSecret && headers.webhookSecret !== expectedSecret) {
      console.log("[Webhook Receiver] ❌ Invalid secret token")
      return res.status(401).json({
        success: false,
        error: "Invalid secret token",
        received_at: new Date().toISOString(),
      })
    }
    
    // Event tipini parse et
    const eventParts = body.event.split(".")
    const entityType = eventParts[0] // product, category, brand, order, etc.
    const action = eventParts[1] // created, updated, deleted
    const entityId = body.data?.id as string
    
    if (!entityId) {
      return res.status(400).json({
        success: false,
        error: "Missing entity ID in data",
        received_at: new Date().toISOString(),
      })
    }
    
    console.log(`[Webhook Receiver] 📥 Received: ${body.event} - ID: ${entityId}`)
    
    // Medusa'dan item detaylarını çek
    let itemDetails: Record<string, unknown> | null = null
    let fetchError: string | null = null
    
    // Deleted event'lerinde item zaten silinmiş olacağından fetch yapmıyoruz
    if (action !== "deleted") {
      try {
        itemDetails = await fetchItemFromMedusa(entityType, entityId, req)
        console.log(`[Webhook Receiver] ✅ Fetched ${entityType} details:`, itemDetails?.id || "N/A")
      } catch (error) {
        fetchError = error instanceof Error ? error.message : "Failed to fetch item"
        console.error(`[Webhook Receiver] ⚠️ Fetch error:`, fetchError)
      }
    }
    
    // İşlem simülasyonu
    const processedResult = {
      entity_type: entityType,
      action: action,
      entity_id: entityId,
      webhook_id: body.webhook_id,
      operation: getOperation(entityType, action),
      item_fetched: !!itemDetails,
      fetch_error: fetchError,
    }
    
    const processingTime = Date.now() - startTime
    
    console.log(`[Webhook Receiver] ✅ Processed in ${processingTime}ms`)
    
    res.status(200).json({
      success: true,
      message: `${body.event} processed successfully`,
      received_at: new Date().toISOString(),
      processing_time_ms: processingTime,
      
      // Webhook bilgileri
      webhook: {
        id: body.webhook_id,
        event: body.event,
        timestamp: body.timestamp,
      },
      
      // İşlem sonucu
      processed: processedResult,
      
      // Medusa'dan çekilen item detayları
      item_details: itemDetails,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Webhook Receiver] ❌ Error:", message)
    
    res.status(500).json({
      success: false,
      error: message,
      received_at: new Date().toISOString(),
    })
  }
}

interface WebhookPayload {
  event: string
  timestamp: string
  webhook_id?: string
  data: {
    id?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * Medusa API'sinden item detaylarını çeker
 */
async function fetchItemFromMedusa(
  entityType: string,
  entityId: string,
  req: MedusaRequest
): Promise<Record<string, unknown> | null> {
  // Medusa API base URL - aynı sunucuda olduğu için localhost kullanıyoruz
  const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  
  // Entity tipine göre endpoint belirle
  const endpointMap: Record<string, string> = {
    product: `/admin/products/${entityId}`,
    category: `/admin/product-categories/${entityId}`,
    brand: `/admin/brands/${entityId}`,
    order: `/admin/orders/${entityId}`,
    customer: `/admin/customers/${entityId}`,
    collection: `/admin/collections/${entityId}`,
    "product_category": `/admin/product-categories/${entityId}`,
  }
  
  const endpoint = endpointMap[entityType]
  if (!endpoint) {
    console.log(`[Webhook Receiver] ⚠️ Unknown entity type: ${entityType}`)
    return null
  }
  
  const url = `${baseUrl}${endpoint}`
  
  // Admin API için authentication header'ı
  // Request'ten mevcut auth cookie veya header'ı al
  const authCookie = req.headers.cookie || ""
  const authHeader = req.headers.authorization || ""
  
  // API Key varsa kullan
  const apiKey = process.env.MEDUSA_ADMIN_API_KEY || ""
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  
  if (apiKey) {
    headers["x-medusa-access-token"] = apiKey
  } else if (authHeader) {
    headers["Authorization"] = authHeader
  } else if (authCookie) {
    headers["Cookie"] = authCookie
  }
  
  console.log(`[Webhook Receiver] 🔗 Fetching: ${url}`)
  
  const response = await fetch(url, {
    method: "GET",
    headers,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  
  const data = await response.json()
  
  // Response formatı entity tipine göre değişir
  // Örn: { product: {...} } veya { category: {...} }
  return data[entityType] || data.product_category || data
}

/**
 * Entity ve action'a göre yapılacak işlemi döndürür
 */
function getOperation(entityType: string, action: string): string {
  const operations: Record<string, Record<string, string>> = {
    product: {
      created: "INSERT new product into external system",
      updated: "UPDATE product in external system",
      deleted: "DELETE product from external system",
    },
    category: {
      created: "CREATE category in external catalog",
      updated: "UPDATE category in external catalog",
      deleted: "REMOVE category from external catalog",
    },
    product_category: {
      created: "CREATE category in external catalog",
      updated: "UPDATE category in external catalog",
      deleted: "REMOVE category from external catalog",
    },
    brand: {
      created: "ADD brand to external brand list",
      updated: "UPDATE brand in external brand list",
      deleted: "REMOVE brand from external brand list",
    },
    order: {
      created: "Send order to fulfillment system",
      updated: "Update order status in fulfillment",
      deleted: "Cancel order in fulfillment system",
    },
    customer: {
      created: "Sync customer to CRM",
      updated: "Update customer in CRM",
      deleted: "Archive customer in CRM",
    },
  }
  
  return operations[entityType]?.[action] || `Process ${entityType}.${action}`
}

// GET - Endpoint durumunu kontrol
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json({
    status: "ready",
    endpoint: "/test/webhook-receiver",
    description: "Webhook receiver - fetches item details from Medusa API based on event type",
    supported_events: [
      "product.created", "product.updated", "product.deleted",
      "category.created", "category.updated", "category.deleted",
      "brand.created", "brand.updated", "brand.deleted",
      "order.created", "order.updated",
      "customer.created", "customer.updated",
    ],
    environment_variables: {
      MEDUSA_BACKEND_URL: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000 (default)",
      MEDUSA_ADMIN_API_KEY: process.env.MEDUSA_ADMIN_API_KEY ? "configured" : "not set",
      WEBHOOK_RECEIVER_SECRET: process.env.WEBHOOK_RECEIVER_SECRET ? "configured" : "using default",
    },
  })
}

// OPTIONS for CORS
export const OPTIONS = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret, X-Webhook-Event, X-Webhook-Timestamp, Authorization")
  res.status(204).end()
}
