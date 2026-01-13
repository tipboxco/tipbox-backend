import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// DELETE /admin/brands/:id/products/all - Brand'e bağlı tüm ürünleri sil
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params
  
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  // Brand'e bağlı tüm ürünleri getir
  const { data: brands } = await query.graph({
    entity: "brand",
    fields: ["id", "product.id"],
    filters: {
      id: brandId,
    },
  })
  
  const brand = brands[0]
  const products = brand?.product ? (Array.isArray(brand.product) ? brand.product : [brand.product]) : []
  
  if (products.length === 0) {
    return res.json({
      success: true,
      brand_id: brandId,
      deleted_count: 0,
      message: "Silinecek ürün bulunamadı",
    })
  }
  
  // Tüm ürün linklerini sil
  let deletedCount = 0
  const errors: string[] = []
  
  for (const product of products) {
    try {
      await remoteLink.dismiss({
        [Modules.PRODUCT]: {
          product_id: product.id,
        },
        brand: {
          brand_id: brandId,
        },
      })
      deletedCount++
    } catch (error: any) {
      errors.push(`Ürün ${product.id} silinirken hata: ${error.message}`)
    }
  }
  
  res.json({
    success: errors.length === 0,
    brand_id: brandId,
    deleted_count: deletedCount,
    total_count: products.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

