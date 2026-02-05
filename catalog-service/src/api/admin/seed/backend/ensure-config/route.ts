import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import type SyncManagerService from "../../../../../modules/sync-manager/service"

type Body = { seed_id?: string; seed_name?: string; relative_path?: string }

/**
 * POST /admin/seed/backend/ensure-config
 * Sadece Medusa sync_config tablosuna kayıt ekler (veya mevcut config'i döner).
 * Tipbox backend'e hiçbir istek gitmez, seed çalıştırılmaz.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const body = (req.body || {}) as Body
    const seedId = typeof body.seed_id === "string" ? body.seed_id : undefined
    const seedName = typeof body.seed_name === "string" ? body.seed_name : undefined
    const relativePath = typeof body.relative_path === "string" ? body.relative_path : undefined

    if (!seedId || !seedName) {
      return res.status(400).json({
        error: "seed_id ve seed_name zorunludur.",
      })
    }

    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const config = await syncManager.ensureBackendSeedConfigForSeed(seedId, seedName, relativePath)

    return res.status(200).json({
      sync_config_id: config.id,
      name: config.name,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return res.status(500).json({ error: message })
  }
}
