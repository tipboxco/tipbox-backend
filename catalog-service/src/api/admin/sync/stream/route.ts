import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../modules/sync-manager"
import type SyncManagerService from "../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/stream
 * Server-Sent Events ile tüm sync konfigürasyonları için real-time güncellemeler
 *
 * Düzeltmeler:
 * - 500ms → 3000ms interval (pool baskısı %83 azaltıldı)
 * - Guard: önceki sorgu bitmeden yeni sorgu başlamaz
 * - Client disconnect durumunda interval temizleniyor
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Credentials", "true")

  res.flushHeaders()

  let isFirstUpdate = true
  let isSending = false
  let closed = false

  const sendUpdate = async (): Promise<void> => {
    if (isSending || closed) return
    isSending = true

    try {
      if (isFirstUpdate) {
        await syncManager.checkAndMarkStaleJobs()
        isFirstUpdate = false
      }

      const configs = await syncManager.listSyncConfigs()

      // Her config için stats al — sequential yaparak pool baskısını azalt
      const configsWithStats: Record<string, unknown>[] = []
      for (const config of configs) {
        if (closed) return
        const stats = await syncManager.getSyncStats(config.id)
        configsWithStats.push({
          ...config,
          stats,
          is_running: stats.running_jobs > 0,
        })
      }

      if (closed) return

      const data = {
        sync_configs: configsWithStats,
        timestamp: new Date().toISOString(),
      }

      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (error) {
      console.error("[SSE] Error:", error)
    } finally {
      isSending = false
    }
  }

  // İlk güncelleme
  await sendUpdate()

  // 3 saniye interval
  const interval = setInterval(async () => {
    try {
      await sendUpdate()
    } catch {
      // Ignore
    }
  }, 3000)

  const cleanup = () => {
    closed = true
    clearInterval(interval)
    try {
      res.end()
    } catch {
      // ignore
    }
  }

  req.on("close", cleanup)
  req.on("error", cleanup)
}
