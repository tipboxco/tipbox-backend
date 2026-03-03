import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/:id/stream
 * Server-Sent Events ile real-time sync güncellemeleri
 *
 * Önceki sorunlar:
 * - 500ms interval → saniyede 6 DB sorgusu → connection pool tükenmesi
 * - Concurrent SSE bağlantıları pool'u dolduruyordu
 *
 * Düzeltmeler:
 * - Interval 3000ms'e çıkarıldı (saniyede 1 sorgu)
 * - Concurrent sorgu sayısı azaltıldı
 * - Guard: önceki sorgu bitmeden yeni sorgu başlamaz
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

  res.flushHeaders()

  let isFirstUpdate = true
  let interval: ReturnType<typeof setInterval> | null = null
  let isSending = false // Guard: aynı anda iki sorgu çalışmasın
  let closed = false

  const cleanup = () => {
    closed = true
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    try {
      res.end()
    } catch {
      // ignore
    }
  }

  // Veriyi gönder; running/pending job yoksa true döner (stream durdurulmalı)
  const sendUpdate = async (): Promise<boolean> => {
    if (isSending || closed) return false
    isSending = true

    try {
      if (isFirstUpdate) {
        await syncManager.checkAndMarkStaleJobs(id)
        isFirstUpdate = false
      }

      const config = await syncManager.retrieveSyncConfig(id)
      const stats = await syncManager.getSyncStats(id)
      const jobs = await syncManager.getJobsBySyncConfig(id, 20)

      if (closed) return true

      const data = {
        sync_config: config,
        stats,
        jobs,
        timestamp: new Date().toISOString(),
      }

      res.write(`data: ${JSON.stringify(data)}\n\n`)

      const hasRunning = jobs.some(
        (j: { status: string }) => j.status === "running" || j.status === "pending"
      )
      return !hasRunning
    } catch (error) {
      console.error("[SSE] Error:", error)
      return true
    } finally {
      isSending = false
    }
  }

  // İlk güncellemeyi gönder
  await sendUpdate()

  // 3 saniye interval — pool baskısını azaltır
  interval = setInterval(async () => {
    try {
      const noRunningNow = await sendUpdate()
      if (noRunningNow && interval) {
        clearInterval(interval)
        interval = null
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: "stream_end", reason: "no_running_jobs" })}\n\n`)
          res.end()
        }
      }
    } catch {
      // ignore
    }
  }, 3000)

  req.on("close", cleanup)
  req.on("error", cleanup)
}
