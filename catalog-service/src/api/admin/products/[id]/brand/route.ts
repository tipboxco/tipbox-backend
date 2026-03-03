import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

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
    filters: { id },
  })

  const product = products[0]

  res.json({ brand: product?.brand || null })
}

// POST /admin/products/:id/brand - Product'a brand ata (upsert)
export const POST = async (
  req: MedusaRequest<LinkBrandType>,
  res: MedusaResponse
) => {
  const { id: productId } = req.params
  const { brand_id: brandId } = req.body as LinkBrandType

  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Mevcut brand'i kontrol et
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "brand.id"],
    filters: { id: productId },
  })

  const currentBrand = products[0]?.brand as Record<string, unknown> | null | undefined

  // Aynı brand'e zaten bağlıysa işlemi atla
  if (currentBrand?.id === brandId) {
    res.json({
      success: true,
      product_id: productId,
      brand_id: brandId,
    })
    return
  }

  // Mevcut link varsa kaldır
  if (currentBrand) {
    try {
      await remoteLink.dismiss({
        [Modules.PRODUCT]: { product_id: productId },
        brand: { brand_id: currentBrand.id as string },
      })
    } catch (dismissError: unknown) {
      const message = dismissError instanceof Error ? dismissError.message : "Link silinemedi"
      console.error("Link silme hatası:", message)
      return res.status(500).json({
        type: "error",
        message: "Mevcut brand linki silinemedi.",
      })
    }
  }

  // Yeni linki oluştur
  try {
    await remoteLink.create({
      [Modules.PRODUCT]: { product_id: productId },
      brand: { brand_id: brandId },
    })
  } catch (createError: unknown) {
    const message = createError instanceof Error ? createError.message : "Link oluşturulamadı"
    console.error("Brand link oluşturma hatası:", message)
    return res.status(500).json({
      type: "error",
      message: message || "Brand link oluşturulamadı.",
    })
  }

  res.json({
    success: true,
    product_id: productId,
    brand_id: brandId,
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
    filters: { id: productId },
  })

  const currentBrand = products[0]?.brand as Record<string, unknown> | null | undefined

  if (currentBrand) {
    try {
      await remoteLink.dismiss({
        [Modules.PRODUCT]: { product_id: productId },
        brand: { brand_id: currentBrand.id as string },
      })
    } catch (dismissError: unknown) {
      const message = dismissError instanceof Error ? dismissError.message : "Link silinemedi"
      console.error("Link silme hatası:", message)
      return res.status(500).json({
        type: "error",
        message: "Brand linki silinemedi.",
      })
    }
  }

  res.json({
    success: true,
    product_id: productId,
    deleted: true,
  })
}
