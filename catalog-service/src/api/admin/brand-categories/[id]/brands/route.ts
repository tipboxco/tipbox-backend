import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { BRAND_MODULE } from "../../../../../modules/brand"
import BrandModuleService from "../../../../../modules/brand/service"

type LinkBrandType = {
  brand_id: string
}

type BulkLinkBrandsType = {
  brand_ids: string[]
}

// GET /admin/brand-categories/:id/brands - Brand category'ye bağlı brandleri getir (DB-level pagination)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)

  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  try {
    // DB seviyesinde filtreleme ve pagination
    const [brands, totalCount] = await brandModuleService.listAndCountBrands(
      { category_id: brandCategoryId },
      {
        skip: offset,
        take: limit,
        order: { name: "ASC" },
        select: ["id", "name", "logo_url", "category_id", "created_at", "updated_at"],
      }
    )

    const formattedBrands = brands.map((brand: Record<string, unknown>) => ({
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url || null,
      category_id: brand.category_id || null,
      created_at: brand.created_at instanceof Date ? brand.created_at.toISOString() : brand.created_at,
      updated_at: brand.updated_at instanceof Date ? brand.updated_at.toISOString() : brand.updated_at,
    }))

    res.json({
      brands: formattedBrands,
      count: totalCount,
      limit,
      offset,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand'ler yüklenirken hata:", message)
    res.status(500).json({
      error: message || "Brand'ler yüklenirken bir hata oluştu",
    })
  }
}

// POST /admin/brand-categories/:id/brands - Brand category'ye brand ekle (tek veya toplu)
export const POST = async (
  req: MedusaRequest<LinkBrandType | BulkLinkBrandsType>,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const body = req.body as LinkBrandType | BulkLinkBrandsType
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)

  try {
    if ("brand_ids" in body && Array.isArray(body.brand_ids)) {
      // Bulk işlem — paralel batch (10'arlı)
      const brandIds = body.brand_ids
      const BATCH_SIZE = 10
      const results: Array<{ brand_id: string; success: boolean; error?: string }> = []

      for (let i = 0; i < brandIds.length; i += BATCH_SIZE) {
        const batch = brandIds.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (brandId) => {
            try {
              await brandModuleService.updateBrands({
                id: brandId,
                category_id: brandCategoryId,
              })
              return { brand_id: brandId, success: true }
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : "Brand güncellenemedi"
              return { brand_id: brandId, success: false, error: message }
            }
          })
        )
        results.push(...batchResults)
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return res.json({
        success: failCount === 0,
        brand_category_id: brandCategoryId,
        total: brandIds.length,
        successful: successCount,
        failed: failCount,
        results,
      })
    } else {
      // Tek brand işlemi
      const { brand_id: brandId } = body as LinkBrandType

      await brandModuleService.updateBrands({
        id: brandId,
        category_id: brandCategoryId,
      })

      res.json({
        success: true,
        brand_category_id: brandCategoryId,
        brand_id: brandId,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand category'ye brand eklenirken hata:", message)
    res.status(500).json({
      error: message || "Brand category'ye brand eklenirken bir hata oluştu",
    })
  }
}

// DELETE /admin/brand-categories/:id/brands - Brand category'den brand kaldır
export const DELETE = async (
  req: MedusaRequest<LinkBrandType>,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const { brand_id: brandId } = req.body as LinkBrandType
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)

  try {
    const brand = await brandModuleService.retrieveBrand(brandId)

    if (brand.category_id === brandCategoryId) {
      await brandModuleService.updateBrands({
        id: brandId,
        category_id: null,
      })
    }

    res.json({
      success: true,
      brand_category_id: brandCategoryId,
      brand_id: brandId,
      deleted: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand category'den brand kaldırılırken hata:", message)
    res.status(500).json({
      error: message || "Brand category'den brand kaldırılırken bir hata oluştu",
    })
  }
}
