import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { 
  updateBrandCategoryWorkflow,
} from "../../../../workflows/update-brand-category"
import { BRAND_MODULE } from "../../../../modules/brand"
import BrandModuleService from "../../../../modules/brand/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const brandCategory = await brandModuleService.retrieveBrandCategory(id)
    
    if (!brandCategory) {
      return res.status(404).json({
        error: "Brand kategorisi bulunamadı",
      })
    }

    // Brand'leri getir - category_id'si bu kategoriye eşit olan brandleri bul
    let brands: any[] = []
    try {
      const allBrands = await brandModuleService.listBrands()
      brands = allBrands
        .filter((brand: any) => brand.category_id === id)
        .map((brand: any) => ({
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url || null,
        }))
    } catch (error) {
      console.error("Brand'ler yüklenirken hata:", error)
    }

    res.json({
      brand_category: {
        id: brandCategory.id,
        title: brandCategory.title,
        thumbnail: brandCategory.thumbnail || null,
        created_at: brandCategory.created_at?.toISOString(),
        updated_at: brandCategory.updated_at?.toISOString(),
        brands,
      },
    })
  } catch (error: any) {
    console.error("Brand kategorisi yüklenirken hata:", error)
    res.status(500).json({
      error: error.message || "Brand kategorisi yüklenirken bir hata oluştu",
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
  } catch (error: any) {
    console.error("Brand kategorisi silinirken hata:", error)
    res.status(500).json({
      error: error.message || "Brand kategorisi silinirken bir hata oluştu",
    })
  }
}

