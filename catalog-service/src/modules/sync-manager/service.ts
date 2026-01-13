import { MedusaService } from "@medusajs/framework/utils"
import { SyncConfig } from "./models/sync-config"
import { SyncJob } from "./models/sync-job"
import { 
  CreateSyncJobInput, 
  UpdateSyncJobInput, 
  SyncJobStatus,
  ModuleType,
  SyncPayload,
  BatchResult,
} from "./types"

class SyncManagerService extends MedusaService({SyncConfig,SyncJob}) {
  /**
   * Aktif sync konfigürasyonlarını getirir
   */
  async getActiveSyncConfigs() {
    return await this.listSyncConfigs({ is_active: true })
  }

  /**
   * Belirli bir modül tipi için aktif sync konfigürasyonlarını getirir
   */
  async getSyncConfigsByModule(moduleType: ModuleType) {
    const configs = await this.listSyncConfigs({ is_active: true })
    return configs.filter(c => c.module_type === moduleType)
  }

  /**
   * Yeni bir sync job oluşturur
   */
  async createJob(input: CreateSyncJobInput) {
    return await this.createSyncJobs({
      ...input,
      status: "pending" as SyncJobStatus,
    })
  }

  /**
   * Sync job'ı günceller
   */
  async updateJob(id: string, input: UpdateSyncJobInput) {
    const jobs = await this.updateSyncJobs({ id, ...input })
    return Array.isArray(jobs) ? jobs[0] : jobs
  }

  /**
   * Sync job'ı başlatır
   */
  async startJob(id: string) {
    return await this.updateJob(id, {
      status: "running",
      started_at: new Date(),
    })
  }

  /**
   * Sync job'ı tamamlar
   */
  async completeJob(id: string, processed: number, failed: number) {
    return await this.updateJob(id, {
      status: failed > 0 && processed === 0 ? "failed" : "completed",
      processed_records: processed,
      failed_records: failed,
      completed_at: new Date(),
    })
  }

  /**
   * Sync job'ı başarısız olarak işaretler
   */
  async failJob(id: string, error: string) {
    return await this.updateJob(id, {
      status: "failed",
      error_message: error,
      completed_at: new Date(),
    })
  }

  /**
   * Batch ilerlemesini günceller
   */
  async updateBatchProgress(id: string, currentBatch: number, processed: number, failed: number) {
    return await this.updateJob(id, {
      current_batch: currentBatch,
      processed_records: processed,
      failed_records: failed,
    })
  }

  /**
   * Belirli bir sync config için job'ları getirir
   */
  async getJobsBySyncConfig(syncConfigId: string, limit: number = 20) {
    const jobs = await this.listSyncJobs(
      { sync_config_id: syncConfigId },
      { 
        order: { created_at: "DESC" },
        take: limit,
      }
    )
    return jobs
  }

  /**
   * Son sync zamanını günceller
   */
  async updateLastSyncTime(configId: string) {
    const configs = await this.updateSyncConfigs({
      id: configId,
      last_sync_at: new Date(),
    })
    return Array.isArray(configs) ? configs[0] : configs
  }

  /**
   * Çalışan job var mı kontrol eder
   */
  async hasRunningJob(syncConfigId: string): Promise<boolean> {
    const jobs = await this.listSyncJobs({
      sync_config_id: syncConfigId,
    })
    return jobs.some(job => job.status === "running" || job.status === "pending")
  }

  /**
   * Batch'i endpoint'e gönderir
   */
  async sendBatch(
    targetUrl: string,
    secretToken: string | null | undefined,
    payload: SyncPayload
  ): Promise<BatchResult> {
    const startTime = Date.now()
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Sync-ID": payload.sync_id,
      "X-Sync-Job-ID": payload.job_id,
      "X-Sync-Module": payload.module_type,
      "X-Sync-Batch": `${payload.batch_number}/${payload.total_batches}`,
      "X-Sync-Timestamp": payload.timestamp,
    }

    if (secretToken) {
      headers["X-Sync-Secret"] = secretToken
    }

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000), // 2 dakika timeout
      })

      const durationMs = Date.now() - startTime
      
      if (response.ok) {
        let result = { processed: payload.data.length, failed: 0 }
        try {
          const responseData = await response.json()
          if (responseData.processed !== undefined) {
            result = responseData
          }
        } catch {
          // JSON parse hatası - varsayılan değerleri kullan
        }

        return {
          batch_number: payload.batch_number,
          success: true,
          status_code: response.status,
          processed: result.processed || payload.data.length,
          failed: result.failed || 0,
          duration_ms: durationMs,
        }
      } else {
        const errorText = await response.text()
        return {
          batch_number: payload.batch_number,
          success: false,
          status_code: response.status,
          processed: 0,
          failed: payload.data.length,
          duration_ms: durationMs,
          error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        }
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      return {
        batch_number: payload.batch_number,
        success: false,
        processed: 0,
        failed: payload.data.length,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Sync istatistiklerini getirir
   */
  async getSyncStats(configId: string) {
    const jobs = await this.listSyncJobs({ sync_config_id: configId })
    
    const total = jobs.length
    const completed = jobs.filter(j => j.status === "completed").length
    const failed = jobs.filter(j => j.status === "failed").length
    const running = jobs.filter(j => j.status === "running").length
    
    const successfulJobs = jobs.filter(j => j.status === "completed")
    const totalRecordsSynced = successfulJobs.reduce((acc, j) => acc + (j.processed_records || 0), 0)
    
    const lastJob = jobs.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    return {
      total_jobs: total,
      completed_jobs: completed,
      failed_jobs: failed,
      running_jobs: running,
      total_records_synced: totalRecordsSynced,
      success_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      last_job: lastJob || null,
    }
  }

  /**
   * Stale (takılmış) job'ları tespit eder ve işaretler
   * 2 dakikadan fazla güncellenmeyen running job'lar stale kabul edilir
   */
  async checkAndMarkStaleJobs(syncConfigId?: string): Promise<number> {
    const filter: Record<string, unknown> = {}
    if (syncConfigId) {
      filter.sync_config_id = syncConfigId
    }
    
    const jobs = await this.listSyncJobs(filter)
    const staleThreshold = 2 * 60 * 1000 // 2 dakika
    const now = Date.now()
    let markedCount = 0
    
    for (const job of jobs) {
      if (job.status === "running" || job.status === "pending") {
        const updatedAt = new Date(job.updated_at).getTime()
        const timeSinceUpdate = now - updatedAt
        
        if (timeSinceUpdate > staleThreshold) {
          // Job takılmış, stale olarak işaretle
          await this.updateJob(job.id, {
            status: "failed",
            error_message: `Job ${timeSinceUpdate > 60000 ? Math.round(timeSinceUpdate / 60000) + " dakika" : Math.round(timeSinceUpdate / 1000) + " saniye"} boyunca yanıt vermedi. İşlem kesintiye uğramış olabilir.`,
            completed_at: new Date(),
          })
          markedCount++
          console.log(`[SyncManager] Marked stale job ${job.id} as failed (no update for ${Math.round(timeSinceUpdate / 1000)}s)`)
        }
      }
    }
    
    return markedCount
  }

  /**
   * Belirli bir job'un durumunu kontrol eder ve stale ise işaretler
   */
  async checkJobHealth(jobId: string): Promise<{ isHealthy: boolean; job: any }> {
    const job = await this.retrieveSyncJob(jobId)
    
    if (!job) {
      return { isHealthy: false, job: null }
    }
    
    if (job.status !== "running" && job.status !== "pending") {
      return { isHealthy: true, job }
    }
    
    const staleThreshold = 2 * 60 * 1000 // 2 dakika
    const now = Date.now()
    const updatedAt = new Date(job.updated_at).getTime()
    const timeSinceUpdate = now - updatedAt
    
    if (timeSinceUpdate > staleThreshold) {
      // Job takılmış
      const updatedJob = await this.updateJob(job.id, {
        status: "failed",
        error_message: `Job ${Math.round(timeSinceUpdate / 60000)} dakika boyunca yanıt vermedi. İşlem kesintiye uğramış olabilir.`,
        completed_at: new Date(),
      })
      return { isHealthy: false, job: updatedJob }
    }
    
    return { isHealthy: true, job }
  }

  /**
   * Running durumundaki job'ları getirir (stale kontrolü ile)
   */
  async getRunningJobs(syncConfigId?: string): Promise<any[]> {
    // Önce stale job'ları işaretle
    await this.checkAndMarkStaleJobs(syncConfigId)
    
    const filter: Record<string, unknown> = {}
    if (syncConfigId) {
      filter.sync_config_id = syncConfigId
    }
    
    const jobs = await this.listSyncJobs(filter)
    return jobs.filter(job => job.status === "running" || job.status === "pending")
  }
}

export default SyncManagerService

