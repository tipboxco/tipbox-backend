import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/jobs/:jobId
 * Tek bir job'ın detayını getirir
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { jobId } = req.params
    
    const job = await syncManager.retrieveSyncJob(jobId)
    
    if (!job) {
      return res.status(404).json({ error: "Job bulunamadı" })
    }
    
    // Config bilgisini de getir
    let config: Awaited<ReturnType<typeof syncManager.retrieveSyncConfig>> | null = null
    try {
      config = await syncManager.retrieveSyncConfig(job.sync_config_id)
    } catch {
      // Config silinmiş olabilir
    }
    
    res.json({ 
      job,
      sync_config: config,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Job bulunamadı" })
    }
    
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/sync/jobs/:jobId
 * Bekleyen veya çalışan bir job'ı iptal eder
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { jobId } = req.params
    
    const job = await syncManager.retrieveSyncJob(jobId)
    
    if (!job) {
      return res.status(404).json({ error: "Job bulunamadı" })
    }
    
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return res.status(400).json({ error: "Bu job zaten tamamlanmış veya iptal edilmiş" })
    }
    
    // Running veya pending job'ı iptal et
    const wasRunning = job.status === "running"
    
    await syncManager.updateJob(jobId, {
      status: "cancelled",
      error_message: wasRunning ? "İşlem kullanıcı tarafından iptal edildi" : "Bekleyen iş iptal edildi",
      completed_at: new Date(),
    })
    
    res.json({ 
      job_id: jobId,
      cancelled: true,
      was_running: wasRunning,
      message: wasRunning 
        ? "Çalışan job iptal edildi. Mevcut batch tamamlandıktan sonra durduracak." 
        : "Bekleyen job iptal edildi.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

