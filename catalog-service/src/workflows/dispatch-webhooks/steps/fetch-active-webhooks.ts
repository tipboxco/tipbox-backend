import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WEBHOOK_MANAGER_MODULE } from "../../../modules/webhook-manager"
import type WebhookManagerService from "../../../modules/webhook-manager/service"

export interface FetchActiveWebhooksInput {
  event_name: string
}

export const fetchActiveWebhooksStep = createStep(
  "fetch-active-webhooks",
  async (input: FetchActiveWebhooksInput, { container }) => {
    const webhookManager = container.resolve<WebhookManagerService>(
      WEBHOOK_MANAGER_MODULE
    )

    const webhooks = await webhookManager.getActiveWebhooksByEvent(
      input.event_name
    )

    return new StepResponse(webhooks)
  }
)

