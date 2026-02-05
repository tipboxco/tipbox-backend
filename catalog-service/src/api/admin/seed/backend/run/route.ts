import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

const TIPBOX_BACKEND_URL = process.env.TIPBOX_BACKEND_URL || "http://localhost:3000"
const TIPBOX_BACKEND_API_KEY = process.env.TIPBOX_BACKEND_API_KEY

function getBackendAuthHeaders(): Record<string, string> {
  if (TIPBOX_BACKEND_API_KEY) {
    return { "X-Seed-Token": TIPBOX_BACKEND_API_KEY }
  }
  return {}
}

type LogLine = { type: "stdout" | "stderr"; line: string }

/**
 * POST /admin/seed/backend/run
 * Sync job oluşturur, Tipbox backend seed'ini çalıştırır, logları job metadata'ya yazar, NDJSON stream proxy'ler.
 */
type RunBody = { seed_id?: string; seed_name?: string }

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  let jobId: string | null = null
  const logLines: LogLine[] = []
  const body = (req.body || {}) as RunBody
  const seedId = typeof body.seed_id === "string" ? body.seed_id : undefined
  const seedName = typeof body.seed_name === "string" ? body.seed_name : undefined

  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    if (!seedId || !seedName) {
      return res.status(400).json({
        error: "Her seed için ayrı sync kullanılıyor; body'de seed_id ve seed_name zorunludur.",
      })
    }

    const seedConfig = await syncManager.ensureBackendSeedConfigForSeed(seedId, seedName)

    const hasRunning = await syncManager.hasRunningJobForAnyBackendSeed()
    if (hasRunning) {
      return res.status(400).json({ error: "Zaten çalışan bir seed job var" })
    }

    const job = await syncManager.createSyncJobs({
      sync_config_id: seedConfig.id,
      total_records: 0,
      total_batches: 1,
      metadata: { seed_id: seedId, seed_name: seedName },
    })
    const createdJob = Array.isArray(job) ? job[0] : job
    jobId = createdJob.id
    await syncManager.startJob(jobId)

    const headers: Record<string, string> = { ...getBackendAuthHeaders() }
    if (!headers["X-Seed-Token"] && !TIPBOX_BACKEND_API_KEY) {
      return res.status(502).json({
        error: "Tipbox backend için TIPBOX_BACKEND_API_KEY tanımlı değil. .env dosyasına ekleyin.",
      })
    }
    const backendRes = await fetch(`${TIPBOX_BACKEND_URL}/api/seeds/run`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ seed_id: seedId, seed_name: seedName }),
    })

    if (!backendRes.ok || !backendRes.body) {
      await syncManager.failJob(jobId, "Backend seed isteği başarısız")
      const err = await backendRes.json().catch(() => ({}))
      return res.status(backendRes.status).json({
        error: (err as { error?: string })?.error || backendRes.statusText,
      })
    }

    res.setHeader("Content-Type", "application/x-ndjson")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("X-Seed-Job-Id", jobId)
    res.flushHeaders?.()

    const reader = backendRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let exitCode: number | undefined

    const send = (obj: object) => {
      res.write(JSON.stringify(obj) + "\n")
      ;(res as any).flush?.()
    }
    send({ type: "job", job_id: jobId })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const raw of lines) {
        if (!raw.trim()) continue
        try {
          const data = JSON.parse(raw) as { type: string; line?: string; seeds?: unknown[] }
          if (data.type === "seeds") {
            send(data)
            continue
          }
          if (data.type === "stdout" || data.type === "stderr") {
            const line = data.line ?? ""
            logLines.push({ type: data.type as "stdout" | "stderr", line })
            send(data)
            const exitMatch = line.match(/\[Exit code: (\d+)\]/)
            if (exitMatch) exitCode = parseInt(exitMatch[1], 10)
          }
        } catch {
          send({ type: "stdout", line: raw })
          logLines.push({ type: "stdout", line: raw })
        }
      }
    }
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer) as { type: string; line?: string }
        if (data.type === "stdout" || data.type === "stderr") {
          logLines.push({ type: data.type as "stdout" | "stderr", line: data.line ?? buffer })
          send(data)
        }
      } catch {
        send({ type: "stdout", line: buffer })
        logLines.push({ type: "stdout", line: buffer })
      }
    }

    const status = exitCode === 0 ? "completed" : "failed"
    await syncManager.updateJobWithLogs(jobId, status, logLines, exitCode)
    send({ type: "job_complete", job_id: jobId, status, exit_code: exitCode })
    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (jobId) {
      try {
        const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
        await syncManager.updateJobWithLogs(jobId, "failed", logLines)
        await syncManager.updateJob(jobId, { error_message: message })
      } catch {}
    }
    if (!res.headersSent) {
      return res.status(500).json({ error: message })
    }
    res.end()
  }
}
