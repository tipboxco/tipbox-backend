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

// GET /admin/brand-categories/:id/brands - Brand category'ye bağlı brandleri getir
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandCategoryId } = req.params
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  
  // Query parametreleri
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  
  try {
    // Tüm brandleri getir
    const allBrands = await brandModuleService.listBrands()
    
    // category_id'si bu kategoriye eşit olan brandleri filtrele
    const categoryBrands = allBrands.filter((brand: any) => brand.category_id === brandCategoryId)
    
    // Pagination uygula
    const totalCount = categoryBrands.length
    const brands = categoryBrands.slice(offset, offset + limit)
    
    // Date'leri string'e çevir
    const formattedBrands = brands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url || null,
      category_id: brand.category_id || null,
      created_at: brand.created_at?.toISOString(),
      updated_at: brand.updated_at?.toISOString(),
    }))
    
    res.json({ 
      brands: formattedBrands,
      count: totalCount,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Brand'ler yüklenirken hata:", error)
    res.status(500).json({
      error: error.message || "Brand'ler yüklenirken bir hata oluştu",
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
    // Toplu işlem kontrolü
    if ("brand_ids" in body && Array.isArray(body.brand_ids)) {
      // Bulk işlem
      const brandIds = body.brand_ids
      const results: Array<{ brand_id: string; success: boolean; error?: string }> = []
      
      for (const brandId of brandIds) {
        try {
          // Brand'in category_id'sini güncelle
          await brandModuleService.updateBrands({
            id: brandId,
            category_id: brandCategoryId,
          })
          
          results.push({ brand_id: brandId, success: true })
        } catch (error: any) {
          results.push({ 
            brand_id: brandId, 
            success: false, 
            error: error.message || "Brand güncellenemedi" 
          })
        }
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
      
      // Brand'in category_id'sini güncelle
      await brandModuleService.updateBrands({
        id: brandId,
        category_id: brandCategoryId,
      })
      
      res.json({ 
        success: true, 
        brand_category_id: brandCategoryId, 
        brand_id: brandId 
      })
    }
  } catch (error: any) {
    console.error("Brand category'ye brand eklenirken hata:", error)
    res.status(500).json({
      error: error.message || "Brand category'ye brand eklenirken bir hata oluştu",
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
    // Brand'in mevcut category_id'sini kontrol et
    const brand = await brandModuleService.retrieveBrand(brandId)
    
    // Eğer brand'in category_id'si bu kategoriye eşitse, null yap
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
      deleted: true 
    })
  } catch (error: any) {
    console.error("Brand category'den brand kaldırılırken hata:", error)
    res.status(500).json({
      error: error.message || "Brand category'den brand kaldırılırken bir hata oluştu",
    })
  }
}

