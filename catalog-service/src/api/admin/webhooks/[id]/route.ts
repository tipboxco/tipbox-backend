import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../../modules/webhook-manager"
import type WebhookManagerService from "../../../../modules/webhook-manager/service"
import { UpdateWebhookConfigInput } from "../../../../modules/webhook-manager/types"

/**
 * GET /admin/webhooks/:id
 * Belirli bir webhook konfigürasyonunu getirir
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params

    const webhook = await webhookManager.retrieveWebhookConfig(id)

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" })
    }

    res.json({ webhook })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Webhook not found" })
    }
    
    res.status(500).json({ error: message })
  }
}

/**
 * PUT /admin/webhooks/:id
 * Bir webhook konfigürasyonunu günceller
 */
export const PUT = async (
  req: MedusaRequest<UpdateWebhookConfigInput>,
  res: MedusaResponse
) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params
    const { event_names, target_url, secret_token, is_active, metadata } = req.body

    // URL validasyonu (eğer sağlanmışsa)
    if (target_url) {
      try {
        new URL(target_url)
      } catch {
        return res.status(400).json({
          error: "Invalid target_url format",
        })
      }
    }

    // event_names validasyonu (eğer sağlanmışsa)
    if (event_names !== undefined) {
      if (!Array.isArray(event_names) || event_names.length === 0) {
        return res.status(400).json({
          error: "event_names must be a non-empty array",
        })
      }
    }

    const updateData: Record<string, unknown> = { id }

    if (event_names !== undefined) updateData.event_names = event_names
    if (target_url !== undefined) updateData.target_url = target_url
    if (secret_token !== undefined) updateData.secret_token = secret_token
    if (is_active !== undefined) updateData.is_active = is_active
    if (metadata !== undefined) updateData.metadata = metadata

    await webhookManager.updateWebhookConfigs(updateData)
    
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

/**
 * DELETE /admin/webhooks/:id
 * Bir webhook konfigürasyonunu siler
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params

    await webhookManager.deleteWebhookConfigs(id)

    res.status(200).json({
      id,
      deleted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Webhook not found" })
    }
    
    res.status(500).json({ error: message })
  }
}
