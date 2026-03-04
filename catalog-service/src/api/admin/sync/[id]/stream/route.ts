import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Response } from "express"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/:id/stream
 * Server-Sent Events ile real-time sync güncellemeleri
 *
 * Optimize:
 * - res.flush() eklendi — veri anında client'a gönderiliyor
 * - Config + stats + jobs paralel çekiliyor (Promise.all)
 * - 2s interval (flush sayesinde daha kısa interval güvenli)
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

      // Paralel çekim — sequential yerine
      const [config, stats, jobs] = await Promise.all([
        syncManager.retrieveSyncConfig(id),
        syncManager.getSyncStats(id),
        syncManager.getJobsBySyncConfig(id, 20),
      ])

      if (closed) return true

      const data = {
        sync_config: config,
        stats,
        jobs,
        timestamp: new Date().toISOString(),
      }

      res.write(`data: ${JSON.stringify(data)}\n\n`)
      flush()

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

  // 2 saniye interval
  interval = setInterval(async () => {
    try {
      const noRunningNow = await sendUpdate()
      if (noRunningNow && interval) {
        clearInterval(interval)
        interval = null
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: "stream_end", reason: "no_running_jobs" })}\n\n`)
          flush()
          res.end()
        }
      }
    } catch {
      // ignore
    }
  }, 2000)

  req.on("close", cleanup)
  req.on("error", cleanup)
}
