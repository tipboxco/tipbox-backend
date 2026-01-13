import { Module } from "@medusajs/framework/utils"
import WebhookManagerService from "./service"

export const WEBHOOK_MANAGER_MODULE = "webhookManager"

const WebhookManagerModule = Module(WEBHOOK_MANAGER_MODULE, {
  service: WebhookManagerService,
})

export default WebhookManagerModule

