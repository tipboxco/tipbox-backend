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

// GET /admin/brands/:id/products - Brand'e bağlı ürünleri getir (DB-level pagination)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params

  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Toplam count için hafif sorgu (sadece product.id)
  const { data: brandsForCount } = await query.graph({
    entity: "brand",
    fields: ["id", "products.id"],
    filters: { id: brandId },
  })

  const brandForCount = brandsForCount[0]
  const allProductIds = brandForCount?.products
    ? (Array.isArray(brandForCount.products) ? brandForCount.products : [brandForCount.products])
    : []
  const totalCount = allProductIds.length

  // Boş sonuç durumunda erken dön
  if (totalCount === 0) {
    res.json({ products: [], count: 0, limit, offset })
    return
  }

  // Sadece sayfa için gereken ürün ID'lerini hesapla ve o ürünleri çek
  const pageProductIds = allProductIds
    .map((p: Record<string, unknown>) => p.id as string)
    .slice(offset, offset + limit)

  if (pageProductIds.length === 0) {
    res.json({ products: [], count: totalCount, limit, offset })
    return
  }

  // Sadece sayfa ürünlerinin detaylarını çek (minimal fields, variants/images yok)
  const { data: productDetails } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "status", "thumbnail"],
    filters: { id: pageProductIds },
  })

  res.json({
    products: productDetails,
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

  // Mevcut linki kaldır ve yeni link oluştur — polling olmadan
  const linkProduct = async (productId: string): Promise<{ product_id: string; success: boolean; error?: string }> => {
    try {
      // Mevcut brand linkini kontrol et
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "brand.id"],
        filters: { id: productId },
      })

      const currentBrand = products[0]?.brand

      // Mevcut link varsa kaldır
      if (currentBrand) {
        await remoteLink.dismiss({
          [Modules.PRODUCT]: { product_id: productId },
          brand: { brand_id: (currentBrand as Record<string, unknown>).id as string },
        })
      }

      // Yeni linki oluştur
      await remoteLink.create({
        [Modules.PRODUCT]: { product_id: productId },
        brand: { brand_id: brandId },
      })

      return { product_id: productId, success: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Link oluşturulamadı"
      console.error(`Product ${productId} için link hatası:`, message)
      return { product_id: productId, success: false, error: message }
    }
  }

  // Toplu işlem kontrolü
  if ("product_ids" in body && Array.isArray(body.product_ids)) {
    const productIds = body.product_ids

    // Batch paralel işlem (10'arlı gruplar)
    const BATCH_SIZE = 10
    const results: Array<{ product_id: string; success: boolean; error?: string }> = []

    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batch = productIds.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(linkProduct))
      results.push(...batchResults)
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
    const result = await linkProduct(productId)

    if (!result.success) {
      return res.status(500).json({
        type: "error",
        message: result.error || "Brand link oluşturulamadı.",
      })
    }

    res.json({
      success: true,
      brand_id: brandId,
      product_id: productId,
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
    [Modules.PRODUCT]: { product_id: productId },
    brand: { brand_id: brandId },
  })

  res.json({
    success: true,
    brand_id: brandId,
    product_id: productId,
    deleted: true,
  })
}
