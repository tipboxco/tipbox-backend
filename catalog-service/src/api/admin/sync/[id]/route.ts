import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../modules/sync-manager"
import type SyncManagerService from "../../../../modules/sync-manager/service"
import { UpdateSyncConfigInput } from "../../../../modules/sync-manager/types"

/**
 * GET /admin/sync/:id
 * Tek bir sync konfigürasyonunu getirir
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { id } = req.params
    
    const config = await syncManager.retrieveSyncConfig(id)
    
    if (!config) {
      return res.status(404).json({ error: "Sync config bulunamadı" })
    }
    
    // Stale job'ları kontrol et ve işaretle
    await syncManager.checkAndMarkStaleJobs(id)
    
    const stats = await syncManager.getSyncStats(id)
    const jobs = await syncManager.getJobsBySyncConfig(id, 10)
    
    res.json({ 
      sync_config: config,
      stats,
      recent_jobs: jobs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Sync config bulunamadı" })
    }
    
    res.status(500).json({ error: message })
  }
}

/**
 * PUT /admin/sync/:id
 * Sync konfigürasyonunu günceller
 */
export const PUT = async (
  req: MedusaRequest<UpdateSyncConfigInput>,
  res: MedusaResponse
) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { id } = req.params
    const { name, module_type, target_url, secret_token, batch_size, is_active, metadata } = req.body
    
    if (target_url) {
      try {
        new URL(target_url)
      } catch {
        return res.status(400).json({ error: "Geçersiz target_url formatı" })
      }
    }
    
    if (module_type) {
      const validModuleTypes = ["product", "category", "brand"]
      if (!validModuleTypes.includes(module_type)) {
        return res.status(400).json({
          error: `Geçersiz module_type. Geçerli değerler: ${validModuleTypes.join(", ")}`,
        })
      }
    }
    
    const updateData: Record<string, unknown> = { id }
    
    if (name !== undefined) updateData.name = name
    if (module_type !== undefined) updateData.module_type = module_type
    if (target_url !== undefined) updateData.target_url = target_url
    if (secret_token !== undefined) updateData.secret_token = secret_token
    if (batch_size !== undefined) updateData.batch_size = batch_size
    if (is_active !== undefined) updateData.is_active = is_active
    if (metadata !== undefined) updateData.metadata = metadata
    
    const configs = await syncManager.updateSyncConfigs(updateData)
    const config = Array.isArray(configs) ? configs[0] : configs
    
    res.json({ sync_config: config })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Sync config bulunamadı" })
    }
    
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/sync/:id
 * Sync konfigürasyonunu siler
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const { id } = req.params
    
    await syncManager.deleteSyncConfigs(id)
    
    res.json({ id, deleted: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Sync config bulunamadı" })
    }
    
    res.status(500).json({ error: message })
  }
}

