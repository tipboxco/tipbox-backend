import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { BRAND_MODULE } from "../../../../../../modules/brand"
import BrandModuleService from "../../../../../../modules/brand/service"

// GET /admin/brand-categories/:id/brands/all - Brand category'ye bağlı tüm brandleri getir (pagination olmadan)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  
  try {
    // Tüm brandleri getir
    const allBrands = await brandModuleService.listBrands()
    
    // category_id'si bu kategoriye eşit olan brandleri filtrele
    const categoryBrands = allBrands.filter((brand: any) => brand.category_id === brandCategoryId)
    
    // Date'leri string'e çevir
    const formattedBrands = categoryBrands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url || null,
      category_id: brand.category_id || null,
      created_at: brand.created_at?.toISOString(),
      updated_at: brand.updated_at?.toISOString(),
    }))
    
    res.json({ 
      brands: formattedBrands,
      count: formattedBrands.length,
    })
  } catch (error: any) {
    console.error("Brand'ler yüklenirken hata:", error)
    res.status(500).json({
      error: error.message || "Brand'ler yüklenirken bir hata oluştu",
    })
  }
}

