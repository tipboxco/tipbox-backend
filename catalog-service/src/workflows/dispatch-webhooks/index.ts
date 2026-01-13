import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { fetchActiveWebhooksStep } from "./steps/fetch-active-webhooks"
import { sendWebhookRequestStep } from "./steps/send-webhook-request"
import { WebhookDispatchResult, WebhookPayload } from "../../modules/webhook-manager/types"

export interface DispatchWebhooksInput {
  event_name: string
  data: unknown
}

export const dispatchWebhooksWorkflow = createWorkflow(
  "dispatch-webhooks",
  (input: DispatchWebhooksInput) => {
    // Aktif webhook'ları getir
    const webhooks = fetchActiveWebhooksStep({
      event_name: input.event_name,
    })

    // Her webhook için payload oluştur ve gönder
    const results = transform(
      { webhooks, input },
      async ({ webhooks, input }) => {
        const timestamp = new Date().toISOString()
        const dispatchResults: WebhookDispatchResult[] = []

        // Tüm webhook'ları paralel olarak işle
        const promises = webhooks.map(async (webhook) => {
          const payload: WebhookPayload = {
            event: input.event_name,
            data: input.data,
            timestamp,
            webhook_id: webhook.id,
          }

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Webhook-Event": payload.event,
            "X-Webhook-Timestamp": payload.timestamp,
          }

          if (webhook.secret_token) {
            headers["X-Webhook-Secret"] = webhook.secret_token
          }

          try {
            const response = await fetch(webhook.target_url, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(30000),
            })

            return {
              webhook_id: webhook.id,
              target_url: webhook.target_url,
              success: response.ok,
              status_code: response.status,
              error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            return {
              webhook_id: webhook.id,
              target_url: webhook.target_url,
              success: false,
              error: errorMessage,
            }
          }
        })

        const results = await Promise.allSettled(promises)
        
        for (const result of results) {
          if (result.status === "fulfilled") {
            dispatchResults.push(result.value)
          }
        }

        return dispatchResults
      }
    )

    return new WorkflowResponse(results)
  }
)

