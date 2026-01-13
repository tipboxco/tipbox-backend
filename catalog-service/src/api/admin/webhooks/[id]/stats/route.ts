import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../../../modules/webhook-manager"
import type WebhookManagerService from "../../../../../modules/webhook-manager/service"

/**
 * GET /admin/webhooks/:id/stats
 * Belirli bir webhook için istatistikleri getirir
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params

    const stats = await webhookManager.getWebhookStats(id)

    res.json({ stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

