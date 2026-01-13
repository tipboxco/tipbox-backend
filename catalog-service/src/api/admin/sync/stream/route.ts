import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../modules/sync-manager"
import type SyncManagerService from "../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/stream
 * Server-Sent Events ile tüm sync konfigürasyonları için real-time güncellemeler
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
  
  // Flush headers immediately
  res.flushHeaders()

  let isFirstUpdate = true
  
  const sendUpdate = async (): Promise<void> => {
    try {
      // İlk güncellemede stale job'ları kontrol et
      if (isFirstUpdate) {
        await syncManager.checkAndMarkStaleJobs()
        isFirstUpdate = false
      }
      
      const configs = await syncManager.listSyncConfigs()
      
      // Her config için stats al
      const configsWithStats = await Promise.all(
        configs.map(async (config) => {
          const stats = await syncManager.getSyncStats(config.id)
          return {
            ...config,
            stats,
            is_running: stats.running_jobs > 0,
          }
        })
      )
      
      const data = {
        sync_configs: configsWithStats,
        timestamp: new Date().toISOString(),
      }
      
      // Her zaman gönder - 500ms interval zaten yeterli throttle
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (error) {
      console.error("[SSE] Error:", error)
    }
  }

  // İlk güncelleme
  await sendUpdate()
  
  // Sabit 500ms interval - hızlı güncelleme
  const interval = setInterval(async () => {
    try {
      await sendUpdate()
    } catch {
      // Ignore
    }
  }, 500)

  const cleanup = () => {
    clearInterval(interval)
    res.end()
  }
  
  req.on("close", cleanup)
  req.on("error", cleanup)
}
