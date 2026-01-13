import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../../../../../modules/brand"

type LinkBrandType = {
  brand_id: string
}

// GET /admin/products/:id/brand - Product'ın brand'ini getir
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "brand.*"],
    filters: {
      id: id,
    },
  })
  
  const product = products[0]
  
  res.json({ brand: product?.brand || null })
}

// POST /admin/products/:id/brand - Product'a brand ata (upsert: create veya update)
export const POST = async (
  req: MedusaRequest<LinkBrandType>,
  res: MedusaResponse
) => {
  const { id: productId } = req.params
  const { brand_id: brandId } = req.body as LinkBrandType
  
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  // Mevcut brand linkini kontrol et ve silme fonksiyonu
  const removeExistingLink = async (): Promise<boolean> => {
    try {
      // Mevcut brand'i kontrol et
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "brand.id"],
        filters: {
          id: productId,
        },
      })
      
      const currentBrand = products[0]?.brand
      
      if (!currentBrand) {
        return true // Link yok, devam edebiliriz
      }
      
      // Aynı brand'e link oluşturmaya çalışıyorsa, işlemi atla
      if (currentBrand.id === brandId) {
        return true // Zaten aynı brand'e bağlı
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
      
      // Link'in gerçekten silindiğini doğrula (max 5 deneme, her biri 100ms bekleme)
      for (let i = 0; i < 5; i++) {
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
          return true // Link başarıyla silindi
        }
      }
      
      // 5 deneme sonrası hala link varsa, false döndür
      console.warn("Link silme işlemi tamamlanamadı, ancak devam ediliyor")
      return false
    } catch (error: any) {
      console.error("Link silme hatası:", error?.message)
      return false
    }
  }
  
  // Önce mevcut linki kaldır
  const linkRemoved = await removeExistingLink()
  
  if (!linkRemoved) {
    // Link silme başarısız oldu, tekrar dene
    await new Promise(resolve => setTimeout(resolve, 200))
    const retryRemoved = await removeExistingLink()
    if (!retryRemoved) {
      return res.status(500).json({
        type: "error",
        message: "Mevcut brand linki silinemedi. Lütfen önce mevcut linki manuel olarak kaldırın.",
      })
    }
  }
  
  // Yeni linki oluştur
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
    // Eğer hala "multiple links" hatası alırsak, son bir kez daha dene
    if (createError.message?.includes("multiple links") || createError.message?.includes("Cannot create")) {
      // Son bir kez daha link silme işlemini dene
      await new Promise(resolve => setTimeout(resolve, 300))
      const finalRemoved = await removeExistingLink()
      
      if (finalRemoved) {
        try {
          await remoteLink.create({
            [Modules.PRODUCT]: {
              product_id: productId,
            },
            brand: {
              brand_id: brandId,
            },
          })
        } catch (finalError: any) {
          console.error("Final retry hatası:", finalError)
          return res.status(500).json({
            type: "invalid_data",
            message: finalError.message || "Brand link oluşturulamadı. Lütfen tekrar deneyin.",
          })
        }
      } else {
        return res.status(500).json({
          type: "invalid_data",
          message: "Mevcut brand linki silinemediği için yeni link oluşturulamadı.",
        })
      }
    } else {
      // Diğer hatalar için
      return res.status(500).json({
        type: "error",
        message: createError.message || "Brand link oluşturulamadı.",
      })
    }
  }
  
  res.json({ 
    success: true, 
    product_id: productId, 
    brand_id: brandId 
  })
}

// DELETE /admin/products/:id/brand - Product'tan brand'i kaldır
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: productId } = req.params
  
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  // Mevcut brand'i bul
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "brand.id"],
    filters: {
      id: productId,
    },
  })
  
  const currentBrand = products[0]?.brand
  
  if (currentBrand) {
    try {
      await remoteLink.dismiss({
        [Modules.PRODUCT]: {
          product_id: productId,
        },
        brand: {
          brand_id: currentBrand.id,
        },
      })
    } catch (dismissError) {
      console.error("Link silme hatası:", dismissError)
      return res.status(500).json({
        type: "error",
        message: "Brand linki silinemedi.",
      })
    }
  }
  
  res.json({ 
    success: true, 
    product_id: productId, 
    deleted: true 
  })
}

