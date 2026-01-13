import { MedusaService } from "@medusajs/framework/utils"
import { WebhookConfig } from "./models/webhook-config"
import { WebhookLog } from "./models/webhook-log"
import { CreateWebhookLogInput } from "./types"

class WebhookManagerService extends MedusaService({
  WebhookConfig,
  WebhookLog,
}) {
  /**
   * Belirli bir event için aktif webhook'ları getirir
   * event_names array'inde bu event'i içeren webhook'ları döndürür
   */
  async getActiveWebhooksByEvent(eventName: string) {
    // Tüm aktif webhook'ları getir
    const allWebhooks = await this.listWebhookConfigs({
      is_active: true,
    })
    
    // Event name'i içerenleri filtrele
    return allWebhooks.filter((webhook) => {
      const eventNames = webhook.event_names as string[]
      return Array.isArray(eventNames) && eventNames.includes(eventName)
    })
  }

  /**
   * Webhook'u aktif/pasif yapar
   */
  async toggleWebhook(id: string, isActive: boolean) {
    return await this.updateWebhookConfigs({
      id,
      is_active: isActive,
    })
  }

  /**
   * Webhook log kaydı oluşturur
   */
  async createLog(input: CreateWebhookLogInput) {
    return await this.createWebhookLogs(input)
  }

  /**
   * Belirli bir webhook için logları getirir
   */
  async getLogsByWebhookId(webhookId: string, limit: number = 50, offset: number = 0) {
    const logs = await this.listWebhookLogs(
      { webhook_id: webhookId },
      { 
        order: { triggered_at: "DESC" },
        take: limit,
        skip: offset,
      }
    )
    
    const allLogs = await this.listWebhookLogs({ webhook_id: webhookId })
    
    return {
      logs,
      count: allLogs.length,
    }
  }

  /**
   * Webhook istatistiklerini getirir
   */
  async getWebhookStats(webhookId: string) {
    const allLogs = await this.listWebhookLogs({ webhook_id: webhookId })
    
    const total = allLogs.length
    const success = allLogs.filter(log => log.status === "success").length
    const failed = allLogs.filter(log => log.status === "failed").length
    
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0
    
    // Son 24 saatteki loglar
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentLogs = allLogs.filter(log => new Date(log.triggered_at) > last24h)
    
    // Ortalama response süresi
    const logsWithDuration = allLogs.filter(log => log.duration_ms != null)
    const avgDuration = logsWithDuration.length > 0 
      ? Math.round(logsWithDuration.reduce((acc, log) => acc + (log.duration_ms || 0), 0) / logsWithDuration.length)
      : 0

    return {
      total_requests: total,
      successful: success,
      failed,
      success_rate: successRate,
      requests_last_24h: recentLogs.length,
      avg_response_time_ms: avgDuration,
    }
  }

  /**
   * Eski logları temizler (varsayılan 30 günden eski)
   */
  async cleanupOldLogs(daysToKeep: number = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    const oldLogs = await this.listWebhookLogs({})
    
    const logsToDelete = oldLogs.filter(log => new Date(log.triggered_at) < cutoffDate)
    
    if (logsToDelete.length > 0) {
      await this.deleteWebhookLogs(logsToDelete.map(log => log.id))
    }
    
    return { deleted: logsToDelete.length }
  }
}

export default WebhookManagerService

