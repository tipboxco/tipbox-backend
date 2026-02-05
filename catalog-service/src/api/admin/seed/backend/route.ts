import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SYNC_MANAGER_MODULE } from "../../../../modules/sync-manager"
import type SyncManagerService from "../../../../modules/sync-manager/service"

const TIPBOX_BACKEND_URL = process.env.TIPBOX_BACKEND_URL || "http://localhost:3000"
const TIPBOX_BACKEND_API_KEY = process.env.TIPBOX_BACKEND_API_KEY

function getBackendAuthHeaders(): Record<string, string> {
  if (TIPBOX_BACKEND_API_KEY) {
    return { "X-Seed-Token": TIPBOX_BACKEND_API_KEY }
  }
  return {}
}


/**
 * GET /admin/seed/backend
 * Tipbox backend'deki seed listesini döndürür (dinamik). Sync config oluşturmaz;
 * daha önce "Çalıştır" ile sync oluşturulduysa sync_config_id döner (job geçmişi için).
 * Not: Tipbox backend X-Seed-Token (SEED_API_TOKEN) bekler; TIPBOX_BACKEND_API_KEY aynı değer olmalı.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const headers: Record<string, string> = {
      ...getBackendAuthHeaders(),
      "Content-Type": "application/json",
    }
    if (!headers["X-Seed-Token"] && !TIPBOX_BACKEND_API_KEY) {
      return res.status(502).json({
        error: "Tipbox backend için TIPBOX_BACKEND_API_KEY tanımlı değil. .env dosyasına ekleyin.",
      })
    }
    const response = await fetch(`${TIPBOX_BACKEND_URL}/api/seeds`, {
      method: "GET",
      headers,
      credentials: "omit",
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: string })?.error || response.statusText
      if (response.status === 401) {
        return res.status(502).json({
          error: "Tipbox backend yetkisi yok. TIPBOX_BACKEND_API_KEY değerini SEED_API_TOKEN ile eşleştirin.",
        })
      }
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: msg })
    }

    const data = await response.json()
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const seeds = (data.data?.seeds ?? []) as Array<{ id: string; name: string; relativePath: string; sourceDir?: string }>
    // Sync config oluşturmuyoruz; sadece daha önce "Ekle" ile oluşturulmuş config varsa sync_config_id döner
    const seedsWithConfig = await Promise.all(
      seeds.map(async (s: { id: string; name: string; relativePath: string; sourceDir?: string }) => {
        const config = await syncManager.getBackendSeedConfigForSeed(s.id, s.name)
        return { ...s, sync_config_id: config?.id ?? null }
      })
    )
    return res.json({
      success: data.success,
      data: {
        seeds: seedsWithConfig,
        count: seedsWithConfig.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return res.status(500).json({ error: message })
  }
}
