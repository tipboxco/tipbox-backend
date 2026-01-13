import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../modules/sync-manager"
import type SyncManagerService from "../../../modules/sync-manager/service"
import { CreateSyncConfigInput } from "../../../modules/sync-manager/types"

/**
 * GET /admin/sync
 * Tüm sync konfigürasyonlarını listeler
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    
    const { module_type, is_active } = req.query
    
    const filters: Record<string, unknown> = {}
    
    if (is_active !== undefined) {
      filters.is_active = is_active === "true"
    }
    
    let configs = await syncManager.listSyncConfigs(filters)
    
    if (module_type && typeof module_type === "string") {
      configs = configs.filter(c => c.module_type === module_type)
    }
    
    // Her config için stats ekle
    const configsWithStats = await Promise.all(
      configs.map(async (config) => {
        const stats = await syncManager.getSyncStats(config.id)
        return { ...config, stats }
      })
    )
    
    res.json({
      sync_configs: configsWithStats,
      count: configsWithStats.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * POST /admin/sync
 * Yeni sync konfigürasyonu oluşturur
 */
export const POST = async (
  req: MedusaRequest<CreateSyncConfigInput>,
  res: MedusaResponse
) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    
    const { name, module_type, target_url, secret_token, batch_size, is_active, metadata } = req.body
    
    if (!name || !module_type || !target_url) {
      return res.status(400).json({
        error: "name, module_type ve target_url zorunludur",
      })
    }
    
    const validModuleTypes = ["product", "category", "brand", "brand_category"]
    if (!validModuleTypes.includes(module_type)) {
      return res.status(400).json({
        error: `Geçersiz module_type. Geçerli değerler: ${validModuleTypes.join(", ")}`,
      })
    }
    
    try {
      new URL(target_url)
    } catch {
      return res.status(400).json({ error: "Geçersiz target_url formatı" })
    }
    
    const config = await syncManager.createSyncConfigs({
      name,
      module_type,
      target_url,
      secret_token: secret_token || null,
      batch_size: batch_size || 1000,
      is_active: is_active ?? true,
      metadata: metadata || null,
    })
    
    res.status(201).json({ sync_config: config })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

