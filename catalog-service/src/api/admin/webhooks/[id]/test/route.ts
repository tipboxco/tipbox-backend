import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WEBHOOK_MANAGER_MODULE } from "../../../../../modules/webhook-manager"
import type WebhookManagerService from "../../../../../modules/webhook-manager/service"
import { WebhookPayload, WebhookLogStatus } from "../../../../../modules/webhook-manager/types"

/**
 * POST /admin/webhooks/:id/test
 * Bir webhook'u test etmek için test isteği gönderir ve logu kaydeder
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const webhookManager = req.scope.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const { id } = req.params

    const webhook = await webhookManager.retrieveWebhookConfig(id)

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" })
    }

    const timestamp = new Date().toISOString()
    const triggeredAt = new Date()
    
    const eventNames = webhook.event_names as unknown as string[]
    
    const testPayload: WebhookPayload = {
      event: "webhook.test",
      data: {
        message: "This is a test webhook payload",
        webhook_id: webhook.id,
        event_names: eventNames,
      },
      timestamp,
      webhook_id: webhook.id,
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "webhook.test",
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-ID": webhook.id,
      "X-Webhook-Test": "true",
    }

    if (webhook.secret_token) {
      headers["X-Webhook-Secret"] = webhook.secret_token
    }

    const startTime = Date.now()
    let status: WebhookLogStatus = "pending"
    let statusCode: number | undefined
    let responseBody: string | undefined
    let errorMessage: string | undefined

    try {
      const response = await fetch(webhook.target_url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(30000),
      })

      statusCode = response.status
      status = response.ok ? "success" : "failed"
      
      try {
        const text = await response.text()
        responseBody = text.substring(0, 2000)
      } catch {
        responseBody = undefined
      }

      if (!response.ok) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }

      const durationMs = Date.now() - startTime

      // Log kaydı oluştur
      try {
        await webhookManager.createLog({
          webhook_id: webhook.id,
          event_name: "webhook.test",
          target_url: webhook.target_url,
          status,
          status_code: statusCode,
          request_body: testPayload as unknown as Record<string, unknown>,
          response_body: responseBody,
          error_message: errorMessage,
          duration_ms: durationMs,
          triggered_at: triggeredAt,
        })
      } catch (logError) {
        console.error(`[Webhook Test] Failed to save log: ${logError}`)
      }

      res.json({
        success: response.ok,
        status_code: statusCode,
        status_text: response.statusText,
        response_body: responseBody?.substring(0, 1000),
        webhook_id: webhook.id,
        target_url: webhook.target_url,
        duration_ms: durationMs,
        timestamp,
        logged: true,
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown error"
      status = "failed"
      
      const durationMs = Date.now() - startTime

      // Başarısız istek için de log kaydı oluştur
      try {
        await webhookManager.createLog({
          webhook_id: webhook.id,
          event_name: "webhook.test",
          target_url: webhook.target_url,
          status,
          status_code: undefined,
          request_body: testPayload as unknown as Record<string, unknown>,
          response_body: undefined,
          error_message: errorMessage,
          duration_ms: durationMs,
          triggered_at: triggeredAt,
        })
      } catch (logError) {
        console.error(`[Webhook Test] Failed to save log: ${logError}`)
      }
      
      res.json({
        success: false,
        error: errorMessage,
        webhook_id: webhook.id,
        target_url: webhook.target_url,
        duration_ms: durationMs,
        timestamp,
        logged: true,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Webhook not found" })
    }
    
    res.status(500).json({ error: message })
  }
}

