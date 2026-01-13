import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../../../modules/webhook-manager"
import type WebhookManagerService from "../../../../../modules/webhook-manager/service"

/**
 * GET /admin/webhooks/:id/logs
 * Belirli bir webhook için logları getirir
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params
    const { limit = "50", offset = "0" } = req.query

    const result = await webhookManager.getLogsByWebhookId(
      id,
      parseInt(limit as string),
      parseInt(offset as string)
    )

    res.json({
      logs: result.logs,
      count: result.count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

