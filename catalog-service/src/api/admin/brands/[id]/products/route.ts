import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type LinkProductType = {
  product_id: string
}

type BulkLinkProductsType = {
  product_ids: string[]
}

// GET /admin/brands/:id/products - Brand'e bağlı ürünleri getir (pagination desteği ile)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params
  
  // Query parametreleri
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const { data: brands } = await query.graph({
    entity: "brand",
    fields: ["id", "name", "product.*", "product.variants.*", "product.images.*"],
    filters: {
      id: brandId,
    },
  })
  
  const brand = brands[0]
  // Product link'i tekil olarak gelir, array'e çeviriyoruz
  const allProducts = brand?.product ? (Array.isArray(brand.product) ? brand.product : [brand.product]) : []
  
  // Pagination uygula
  const totalCount = allProducts.length
  const products = allProducts.slice(offset, offset + limit)
  
  res.json({ 
    products,
    count: totalCount,
    limit,
    offset,
  })
}

// POST /admin/brands/:id/products - Brand'e ürün ekle (tek veya toplu)
export const POST = async (
  req: MedusaRequest<LinkProductType | BulkLinkProductsType>,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params
  const body = req.body as LinkProductType | BulkLinkProductsType
  
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  // Mevcut linki kaldırma fonksiyonu
  const removeExistingLink = async (productId: string): Promise<boolean> => {
    try {
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "brand.id"],
        filters: {
          id: productId,
        },
      })
      
      const currentBrand = products[0]?.brand
      
      if (!currentBrand) {
        return true
      }
      
      // Mevcut linki sil
      await remoteLink.dismiss({
        [Modules.PRODUCT]: {
          product_id: productId,
        },
        brand: {
          brand_id: currentBrand.id,
        },
      })
      
      // Link'in gerçekten silindiğini doğrula
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { data: recheckProducts } = await query.graph({
          entity: "product",
          fields: ["id", "brand.id"],
          filters: {
            id: productId,
          },
        })
        
        const recheckBrand = recheckProducts[0]?.brand
        if (!recheckBrand) {
          return true
        }
      }
      
      return false
    } catch (error: any) {
      console.error(`Product ${productId} için link silme hatası:`, error?.message)
      return false
    }
  }
  
  // Toplu işlem kontrolü
  if ("product_ids" in body && Array.isArray(body.product_ids)) {
    // Bulk işlem
    const productIds = body.product_ids
    const results: Array<{ product_id: string; success: boolean; error?: string }> = []
    
    for (const productId of productIds) {
      try {
        // Mevcut linki kaldır
        await removeExistingLink(productId)
        
        // Yeni linki oluştur
        await remoteLink.create({
          [Modules.PRODUCT]: {
            product_id: productId,
          },
          brand: {
            brand_id: brandId,
          },
        })
        
        results.push({ product_id: productId, success: true })
      } catch (error: any) {
        // "multiple links" hatası alırsak, tekrar dene
        if (error.message?.includes("multiple links") || error.message?.includes("Cannot create")) {
          try {
            await new Promise(resolve => setTimeout(resolve, 200))
            const removed = await removeExistingLink(productId)
            
            if (removed) {
              await remoteLink.create({
                [Modules.PRODUCT]: {
                  product_id: productId,
                },
                brand: {
                  brand_id: brandId,
                },
              })
              results.push({ product_id: productId, success: true })
            } else {
              results.push({ 
                product_id: productId, 
                success: false, 
                error: "Mevcut link silinemedi" 
              })
            }
          } catch (retryError: any) {
            results.push({ 
              product_id: productId, 
              success: false, 
              error: retryError.message || "Link oluşturulamadı" 
            })
          }
        } else {
          results.push({ 
            product_id: productId, 
            success: false, 
            error: error.message || "Link oluşturulamadı" 
          })
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    return res.json({
      success: failCount === 0,
      brand_id: brandId,
      total: productIds.length,
      successful: successCount,
      failed: failCount,
      results,
    })
  } else {
    // Tek ürün işlemi
    const { product_id: productId } = body as LinkProductType
    
    // Mevcut linki kaldır
    await removeExistingLink(productId)
    
    // Linki oluştur
    try {
      await remoteLink.create({
        [Modules.PRODUCT]: {
          product_id: productId,
        },
        brand: {
          brand_id: brandId,
        },
      })
    } catch (createError: any) {
      // "multiple links" hatası alırsak, tekrar dene
      if (createError.message?.includes("multiple links") || createError.message?.includes("Cannot create")) {
        await new Promise(resolve => setTimeout(resolve, 200))
        const removed = await removeExistingLink(productId)
        
        if (removed) {
          await remoteLink.create({
            [Modules.PRODUCT]: {
              product_id: productId,
            },
            brand: {
              brand_id: brandId,
            },
          })
        } else {
          return res.status(500).json({
            type: "error",
            message: "Mevcut brand linki silinemediği için yeni link oluşturulamadı.",
          })
        }
      } else {
        return res.status(500).json({
          type: "error",
          message: createError.message || "Brand link oluşturulamadı.",
        })
      }
    }
    
    res.json({ 
      success: true, 
      brand_id: brandId, 
      product_id: productId 
    })
  }
}

// DELETE /admin/brands/:id/products - Brand'den ürün kaldır
export const DELETE = async (
  req: MedusaRequest<LinkProductType>,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params
  const { product_id: productId } = req.body as LinkProductType
  
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  
  await remoteLink.dismiss({
    [Modules.PRODUCT]: {
      product_id: productId,
    },
    brand: {
      brand_id: brandId,
    },
  })
  
  res.json({ 
    success: true, 
    brand_id: brandId, 
    product_id: productId,
    deleted: true 
  })
}

