import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

/**
 * GET /admin/sync/:id/jobs
 * Belirli bir sync config için job'ları listeler
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { id } = req.params
    const { limit = "20", status } = req.query
    
    let jobs = await syncManager.getJobsBySyncConfig(id, parseInt(limit as string))
    
    if (status && typeof status === "string") {
      jobs = jobs.filter(j => j.status === status)
    }
    
    res.json({
      jobs,
      count: jobs.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

