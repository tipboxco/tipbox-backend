import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WebhookDispatchResult, WebhookPayload } from "../../../modules/webhook-manager/types"

export interface SendWebhookRequestInput {
  webhook_id: string
  target_url: string
  secret_token?: string | null
  payload: WebhookPayload
}

export const sendWebhookRequestStep = createStep(
  "send-webhook-request",
  async (input: SendWebhookRequestInput): Promise<StepResponse<WebhookDispatchResult>> => {
    const { webhook_id, target_url, secret_token, payload } = input

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Timestamp": payload.timestamp,
    }

    if (secret_token) {
      headers["X-Webhook-Secret"] = secret_token
    }

    try {
      const response = await fetch(target_url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 saniye timeout
      })

      const result: WebhookDispatchResult = {
        webhook_id,
        target_url,
        success: response.ok,
        status_code: response.status,
      }

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`
      }

      return new StepResponse(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      return new StepResponse({
        webhook_id,
        target_url,
        success: false,
        error: errorMessage,
      })
    }
  }
)

