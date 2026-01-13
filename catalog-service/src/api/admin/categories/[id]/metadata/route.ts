import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

type UpdateCategoryMetadataType = {
  thumb_image?: string | null
  banner_image?: string | null
}

// PUT /admin/categories/:id/metadata - Category metadata güncelle
export const PUT = async (
  req: MedusaRequest<UpdateCategoryMetadataType>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const { thumb_image, banner_image } = req.body as UpdateCategoryMetadataType

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Mevcut kategoriyi ve metadata'sını al
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle", "metadata"],
      filters: {
        id,
      },
    })

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        error: "Kategori bulunamadı",
      })
    }

    const category = categories[0]
    const currentMetadata = category.metadata || {}

    // Yeni metadata'yı oluştur (mevcut metadata'yı koru, sadece thumb ve banner'ı güncelle)
    const updatedMetadata = {
      ...currentMetadata,
    }

    if (thumb_image !== undefined) {
      if (thumb_image === null) {
        delete updatedMetadata.thumb_image
      } else {
        updatedMetadata.thumb_image = thumb_image
      }
    }

    if (banner_image !== undefined) {
      if (banner_image === null) {
        delete updatedMetadata.banner_image
      } else {
        updatedMetadata.banner_image = banner_image
      }
    }

    // Category'yi güncelle
    const { result } = await updateProductCategoriesWorkflow(req.scope).run({
      input: {
        selector: { id },
        update: {
          metadata: updatedMetadata,
        },
      },
    })

    const updatedCategory = result?.[0]

    if (!updatedCategory) {
      return res.status(500).json({
        error: "Kategori güncellenirken hata oluştu",
      })
    }

    res.json({
      category: updatedCategory,
    })
  } catch (error: any) {
    console.error("Category metadata güncelleme hatası:", error)
    res.status(500).json({
      error: error.message || "Kategori metadata güncellenirken hata oluştu",
    })
  }
}

