import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { IEventBusModuleService } from "@medusajs/framework/types"
import { BRAND_MODULE } from "../../../../modules/brand"
import BrandModuleService from "../../../../modules/brand/service"

type UpdateBrandType = {
  name?: string
  handle?: string | null
  website_url?: string | null
  logo_url?: string | null
  banner_url?: string | null
  metadata?: any | null
  rank?: number | null
  ispopular?: boolean | null
  tags?: any | null
  category_id?: string | null
}

// GET /admin/brands/:id - Tek bir brand getir
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params
  
  const brand = await brandModuleService.retrieveBrand(id)
  
  // Category bilgisini getir
  let category = null
  if (brand.category_id) {
    try {
      const { data: categoryData } = await query.graph({
        entity: "brand_category",
        fields: ["id", "title"],
        filters: {
          id: brand.category_id,
        },
      })
      if (categoryData[0]) {
        category = {
          id: categoryData[0].id,
          title: categoryData[0].title,
        }
      }
    } catch {
      // Category bulunamazsa null
    }
  }
  
  res.json({ 
    brand: {
      ...brand,
      category,
    }
  })
}

// PUT /admin/brands/:id - Brand güncelle
export const PUT = async (
  req: MedusaRequest<UpdateBrandType>,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const eventBus = req.scope.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  const { id } = req.params
  
  const updateData = req.body as UpdateBrandType
  
  try {
    // Güncellemeden önce mevcut brand'i al (değişiklikleri karşılaştırmak için)
    const previousBrand = await brandModuleService.retrieveBrand(id)
    
    const brands = await brandModuleService.updateBrands({...updateData,id})
    
    // updateBrands array döndürür, ilk elemanı al
    const brand = Array.isArray(brands) ? brands[0] : brands
    
    // Güncellenmiş brand'i tekrar çek
    const updatedBrand = await brandModuleService.retrieveBrand(id)
    
    // Event emit - Tam veri ile
    await eventBus.emit({
      name: "brand.updated",
      data: {
        id: updatedBrand.id,
        name: updatedBrand.name,
        logo_url: updatedBrand?.logo_url || null,
        created_at: updatedBrand.created_at,
        updated_at: updatedBrand.updated_at,
        previous: {
          name: previousBrand.name,
          logo_url: previousBrand.logo_url || null,
        },
        changes: updateData,
      },
    })
    
    res.json({ brand: updatedBrand || brand })
  } catch (error: any) {
    console.error("Brand update error:", error)
    res.status(500).json({ 
      error: "Marka güncellenirken hata oluştu",
      message: error.message 
    })
  }
}

// DELETE /admin/brands/:id - Brand sil
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const eventBus = req.scope.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  const { id } = req.params
  
  // Silmeden önce brand bilgisini al (event için tam veri)
  let brandData: Record<string, unknown> = { id }
  try {
    const brand = await brandModuleService.retrieveBrand(id)
    brandData = {
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url || null,
      created_at: brand.created_at,
      updated_at: brand.updated_at,
      deleted_at: new Date().toISOString(),
    }
  } catch {
    // Brand bulunamazsa sadece id ile devam et
  }
  
  await brandModuleService.deleteBrands(id)
  
  // Event emit - Tam veri ile
  await eventBus.emit({
    name: "brand.deleted",
    data: brandData,
  })
  
  res.json({ id, object: "brand", deleted: true })
}

