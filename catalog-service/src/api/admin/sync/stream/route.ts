import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Response } from "express"
import { SYNC_MANAGER_MODULE } from "../../../../modules/sync-manager"
import type SyncManagerService from "../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/stream
 * Server-Sent Events ile tüm sync konfigürasyonları için real-time güncellemeler
 *
 * Optimize:
 * - res.flush() eklendi — veri anında client'a gönderiliyor
 * - Stats paralel çekiliyor (Promise.all) — N×latency yerine 1×latency
 * - 2s interval (3s'ten düşürüldü — flush ile pool baskısı zaten azaldı)
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

  const flush = () => {
    try {
      if (typeof (res as unknown as Response).flush === "function") {
        ;(res as unknown as Response).flush()
      }
    } catch {
      // ignore
    }
  }

  const sendUpdate = async (): Promise<void> => {
    if (isSending || closed) return
    isSending = true

    try {
      if (isFirstUpdate) {
        await syncManager.checkAndMarkStaleJobs()
        isFirstUpdate = false
      }

      const configs = await syncManager.listSyncConfigs()
      if (closed) return

      // Paralel stats çekimi — sequential yerine
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

      if (closed) return

      const data = {
        sync_configs: configsWithStats,
        timestamp: new Date().toISOString(),
      }

      res.write(`data: ${JSON.stringify(data)}\n\n`)
      flush()
    } catch (error) {
      console.error("[SSE] Error:", error)
    } finally {
      isSending = false
    }
  }

  // İlk güncelleme
  await sendUpdate()

  // 2 saniye interval
  const interval = setInterval(async () => {
    try {
      await sendUpdate()
    } catch {
      // Ignore
    }
  }, 2000)

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
