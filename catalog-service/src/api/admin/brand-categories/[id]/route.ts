import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  updateBrandCategoryWorkflow,
} from "../../../../workflows/update-brand-category"
import { BRAND_MODULE } from "../../../../modules/brand"
import BrandModuleService from "../../../../modules/brand/service"

type PutAdminUpdateBrandCategoryType = {
  title?: string
  thumbnail?: string | null
}

// GET /admin/brand-categories/:id - Brand category detayını getir
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const { id } = req.params

  try {
    const brandCategory = await brandModuleService.retrieveBrandCategory(id)

    if (!brandCategory) {
      return res.status(404).json({
        error: "Brand kategorisi bulunamadı",
      })
    }

    // DB seviyesinde filtreleme — sadece bu kategoriye ait brand'leri çek
    const brands = await brandModuleService.listBrands(
      { category_id: id },
      { select: ["id", "name", "logo_url"] }
    )

    const formattedBrands = brands.map((brand: Record<string, unknown>) => ({
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url || null,
    }))

    res.json({
      brand_category: {
        id: brandCategory.id,
        title: brandCategory.title,
        thumbnail: brandCategory.thumbnail || null,
        created_at: brandCategory.created_at instanceof Date
          ? brandCategory.created_at.toISOString()
          : brandCategory.created_at,
        updated_at: brandCategory.updated_at instanceof Date
          ? brandCategory.updated_at.toISOString()
          : brandCategory.updated_at,
        brands: formattedBrands,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand kategorisi yüklenirken hata:", message)
    res.status(500).json({
      error: message || "Brand kategorisi yüklenirken bir hata oluştu",
    })
  }
}

// PUT /admin/brand-categories/:id - Brand category güncelle
export const PUT = async (
  req: MedusaRequest<PutAdminUpdateBrandCategoryType>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { result } = await updateBrandCategoryWorkflow(req.scope)
    .run({
      input: {
        id,
        ...req.body,
      },
    })

  res.json({ brand_category: result })
}

// DELETE /admin/brand-categories/:id - Brand category sil
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const { id } = req.params

  try {
    await brandModuleService.deleteBrandCategories(id)
    res.status(204).send()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("Brand kategorisi silinirken hata:", message)
    res.status(500).json({
      error: message || "Brand kategorisi silinirken bir hata oluştu",
    })
  }
}
