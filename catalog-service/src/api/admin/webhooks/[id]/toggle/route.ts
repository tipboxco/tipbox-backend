import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../../../modules/webhook-manager"
import type WebhookManagerService from "../../../../../modules/webhook-manager/service"

interface ToggleWebhookInput {
  is_active: boolean
}

/**
 * POST /admin/webhooks/:id/toggle
 * Bir webhook'un aktif/pasif durumunu değiştirir
 */
export const POST = async (
  req: MedusaRequest<ToggleWebhookInput>,
  res: MedusaResponse
) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params
    const { is_active } = req.body

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        error: "is_active must be a boolean",
      })
    }

    await webhookManager.toggleWebhook(id, is_active)
    
    // Güncellenmiş webhook'u getir
    const webhook = await webhookManager.retrieveWebhookConfig(id)

    res.json({ webhook })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Webhook not found" })
    }
    
    res.status(500).json({ error: message })
  }
}

