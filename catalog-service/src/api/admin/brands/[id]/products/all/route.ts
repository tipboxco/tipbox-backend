import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// DELETE /admin/brands/:id/products/all - Brand'e bağlı tüm ürünleri sil (paralel batch)
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id: brandId } = req.params

  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Brand'e bağlı tüm ürünleri getir (sadece ID)
  const { data: brands } = await query.graph({
    entity: "brand",
    fields: ["id", "products.id"],
    filters: { id: brandId },
  })

  const brand = brands[0]
  const products = brand?.products
    ? (Array.isArray(brand.products) ? brand.products : [brand.products])
    : []

  if (products.length === 0) {
    return res.json({
      success: true,
      brand_id: brandId,
      deleted_count: 0,
      message: "Silinecek ürün bulunamadı",
    })
  }

  // Paralel batch dismiss (20'şerli gruplar)
  const BATCH_SIZE = 20
  let deletedCount = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (product: Record<string, unknown>) => {
        try {
          await remoteLink.dismiss({
            [Modules.PRODUCT]: { product_id: product.id as string },
            brand: { brand_id: brandId },
          })
          return { success: true }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Bilinmeyen hata"
          return { success: false, error: `Ürün ${product.id} silinirken hata: ${message}` }
        }
      })
    )

    for (const result of results) {
      if (result.success) {
        deletedCount++
      } else if (result.error) {
        errors.push(result.error)
      }
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
