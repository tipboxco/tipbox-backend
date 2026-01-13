import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/:id/stream
 * Server-Sent Events ile real-time sync güncellemeleri
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
  const { id } = req.params

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
  
  // Veriyi gönder - her zaman gönder (hash karşılaştırması yok)
  const sendUpdate = async (): Promise<void> => {
    try {
      // İlk güncellemede stale job'ları kontrol et
      if (isFirstUpdate) {
        await syncManager.checkAndMarkStaleJobs(id)
        isFirstUpdate = false
      }
      
      const config = await syncManager.retrieveSyncConfig(id)
      const stats = await syncManager.getSyncStats(id)
      const jobs = await syncManager.getJobsBySyncConfig(id, 20)
      
      const data = {
        sync_config: config,
        stats,
        jobs,
        timestamp: new Date().toISOString(),
      }
      
      // Her zaman gönder - 500ms interval zaten yeterli throttle
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (error) {
      console.error("[SSE] Error:", error)
    }
  }

  // İlk güncellemeyi gönder
  await sendUpdate()
  
  // Sabit 500ms interval - hızlı güncelleme
  const interval = setInterval(async () => {
    try {
      await sendUpdate()
    } catch {
      // Ignore
    }
  }, 500)

  // Cleanup
  const cleanup = () => {
    clearInterval(interval)
    res.end()
  }
  
  req.on("close", cleanup)
  req.on("error", cleanup)
}
