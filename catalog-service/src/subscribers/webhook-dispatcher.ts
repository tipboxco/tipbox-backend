import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { WEBHOOK_MANAGER_MODULE } from "../modules/webhook-manager"
import type WebhookManagerService from "../modules/webhook-manager/service"
import { WebhookPayload, WebhookLogStatus } from "../modules/webhook-manager/types"

/**
 * Merkezi Webhook Dispatcher Subscriber
 * 
 * Bu subscriber, tanımlanan event'leri dinler ve eşleşen 
 * aktif webhook'lara POST istekleri gönderir.
 */

// Desteklenen eventler
const SUPPORTED_EVENTS = [
  "product.updated",
  "product.created",
  "product.deleted",
  "product-category.updated",
  "product-category.created",
  "product-category.deleted",
  "order.placed",
  "order.updated",
  "order.completed",
  "order.canceled",
  "customer.created",
  "customer.updated",
  "brand.created",
  "brand.updated",
  "brand.deleted",
] as const

/**
 * Webhook isteklerini asenkron olarak gönderir ve loglar
 */
async function dispatchWebhooks(
  webhookManager: WebhookManagerService,
  eventName: string,
  eventData: unknown
): Promise<void> {
  try {
    // Aktif webhook'ları getir
    const webhooks = await webhookManager.getActiveWebhooksByEvent(eventName)

    if (!webhooks || webhooks.length === 0) {
      return
    }

    const timestamp = new Date().toISOString()
    const triggeredAt = new Date()

    // Tüm webhook'ları paralel olarak işle
    const promises = webhooks.map(async (webhook) => {
      const payload: WebhookPayload = {
        event: eventName,
        data: eventData,
        timestamp,
        webhook_id: webhook.id,
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": eventName,
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-ID": webhook.id,
      }

      // Secret token varsa header'a ekle
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
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000), // 30 saniye timeout
        })

        statusCode = response.status
        status = response.ok ? "success" : "failed"

        // Response body'yi al (ilk 2000 karakter)
        try {
          const text = await response.text()
          responseBody = text.substring(0, 2000)
        } catch {
          responseBody = undefined
        }

        if (!response.ok) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
          console.error(
            `[Webhook] Failed to dispatch to ${webhook.target_url}: ${errorMessage}`
          )
        } else {
          console.log(
            `[Webhook] Successfully dispatched ${eventName} to ${webhook.target_url}`
          )
        }
      } catch (error) {
        status = "failed"
        errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error(
          `[Webhook] Error dispatching to ${webhook.target_url}: ${errorMessage}`
        )
      }

      const durationMs = Date.now() - startTime

      // Log kaydı oluştur
      try {
        await webhookManager.createLog({
          webhook_id: webhook.id,
          event_name: eventName,
          target_url: webhook.target_url,
          status,
          status_code: statusCode,
          request_body: payload as unknown as Record<string, unknown>,
          response_body: responseBody,
          error_message: errorMessage,
          duration_ms: durationMs,
          triggered_at: triggeredAt,
        })
      } catch (logError) {
        console.error(`[Webhook] Failed to save log: ${logError}`)
      }

      return {
        webhook_id: webhook.id,
        success: status === "success",
        status_code: statusCode,
        duration_ms: durationMs,
      }
    })

    // Tüm isteklerin tamamlanmasını bekle (hata olsa bile devam et)
    await Promise.allSettled(promises)
  } catch (error) {
    console.error(`[Webhook] Error in dispatchWebhooks: ${error}`)
  }
}

/**
 * Ana subscriber handler
 */
export default async function webhookDispatcherHandler({
  event,
  container,
}: SubscriberArgs<Record<string, unknown>>): Promise<void> {
  const eventName = event.name

  try {
    const webhookManager = container.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    // Event verilerini hazırla
    const eventData = {
      ...event.data,
      metadata: event.metadata,
    }

    // Webhook'ları asenkron olarak dispatch et (fire-and-forget)
    // Ana işlemi bloke etmemek için await kullanmıyoruz
    dispatchWebhooks(webhookManager, eventName, eventData).catch((error) => {
      console.error(`[Webhook] Dispatch error for ${eventName}: ${error}`)
    })
  } catch (error) {
    console.error(`[Webhook] Handler error for ${eventName}: ${error}`)
  }
}

export const config: SubscriberConfig = {
  event: SUPPORTED_EVENTS as unknown as string[],
}
