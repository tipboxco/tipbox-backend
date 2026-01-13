import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../modules/webhook-manager"
import type WebhookManagerService from "../../../modules/webhook-manager/service"
import { CreateWebhookConfigInput } from "../../../modules/webhook-manager/types"

/**
 * GET /admin/webhooks
 * Tüm webhook konfigürasyonlarını listeler
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { event_name, is_active } = req.query

    const filters: Record<string, unknown> = {}

    if (is_active !== undefined) {
      filters.is_active = is_active === "true"
    }

    let webhooks = await webhookManager.listWebhookConfigs(filters)

    // event_name filtresi varsa, o event'i içeren webhook'ları filtrele
    if (event_name && typeof event_name === "string") {
      webhooks = webhooks.filter((webhook) => {
        const eventNames = webhook.event_names as string[]
        return Array.isArray(eventNames) && eventNames.includes(event_name)
      })
    }

    res.json({
      webhooks,
      count: webhooks.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * POST /admin/webhooks
 * Yeni bir webhook konfigürasyonu oluşturur
 */
export const POST = async (
  req: MedusaRequest<CreateWebhookConfigInput>,
  res: MedusaResponse
) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { event_names, target_url, secret_token, is_active, metadata } = req.body

    // Validasyon
    if (!event_names || !Array.isArray(event_names) || event_names.length === 0) {
      return res.status(400).json({
        error: "event_names array is required and must contain at least one event",
      })
    }

    if (!target_url) {
      return res.status(400).json({
        error: "target_url is required",
      })
    }

    // URL validasyonu
    try {
      new URL(target_url)
    } catch {
      return res.status(400).json({
        error: "Invalid target_url format",
      })
    }

    const result = await webhookManager.createWebhookConfigs({
      event_names,
      target_url,
      secret_token: secret_token || null,
      is_active: is_active ?? true,
      metadata: metadata || null,
    })
    
    // createWebhookConfigs tek obje döndürür
    const webhook = Array.isArray(result) ? result[0] : result

    res.status(201).json({ webhook })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}
