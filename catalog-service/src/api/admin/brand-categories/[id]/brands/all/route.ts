import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { BRAND_MODULE } from "../../../../../../modules/brand"
import BrandModuleService from "../../../../../../modules/brand/service"

// GET /admin/brand-categories/:id/brands/all - Brand category'ye bağlı tüm brandleri getir (DB filtreleme)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)

  try {
    // DB seviyesinde filtreleme — tüm brand'leri yüklemek yerine sadece bu kategoriye ait olanları çek
    const brands = await brandModuleService.listBrands(
      { category_id: brandCategoryId },
      { select: ["id", "name", "logo_url", "category_id", "created_at", "updated_at"] }
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
      count: formattedBrands.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand'ler yüklenirken hata:", message)
    res.status(500).json({
      error: message || "Brand'ler yüklenirken bir hata oluştu",
    })
  }
}
