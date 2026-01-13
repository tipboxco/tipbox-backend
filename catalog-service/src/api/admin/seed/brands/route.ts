import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../../../../modules/brand"
import BrandModuleService from "../../../../modules/brand/service"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

/**
 * POST /admin/seed/brands
 * Brands seed işlemini başlatır (bulk ekleme)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const brandModuleService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")

    // Brands CSV'yi oku
    const brandsCsvPath = path.join(csvDataPath, "brands.csv")
    if (!fs.existsSync(brandsCsvPath)) {
      return res.status(404).json({ error: "Brands CSV dosyası bulunamadı" })
    }

    const brandsCsvContent = fs.readFileSync(brandsCsvPath, "utf-8")
    const brandsData = Papa.parse(brandsCsvContent, {
      header: true,
      skipEmptyLines: true,
    }).data as any[]

    // Bulk payload'u hazırla
    // csv'den gelen id değerini metadata kolonuna kaydediyoruz
    const brandsToCreate = brandsData.map((brandRow) => ({
      name: brandRow.name,
      category_id: null, // Gerekirse burada eşleştirip doldurabilirsiniz
      metadata: {
        ...(brandRow.metadata || {}),
        brand_id: brandRow.id, // csv'den gelen id değerini metadata'ya ekle
      },
    }))

    // Toplu ekle
    let createdBrands: any[] = []
    try {
      if (typeof brandModuleService.createBrands === "function") {
        createdBrands = await brandModuleService.createBrands(brandsToCreate)
      } else {
        throw new Error("brandModuleService.createBrands bulk metodu bulunamadı")
      }
    } catch (err: any) {
      logger.error("Toplu marka oluşturulurken hata: " + err.message)
      return res.status(500).json({ error: "Toplu marka oluşturulurken hata: " + err.message })
    }

    // Id eşlemesi için - eski id : yeni id
    const brandMap = new Map<string, string>()
    // logo_url güncellenecek markalar
    const brandsWithLogo = brandsData.filter((b: any) => b.logo_url)
    let logoUpdateErrors: string[] = []

    // Eşleşmeleri kur
    for (let i = 0; i < brandsData.length; i++) {
      const originalId = brandsData[i]?.id
      const createdId = createdBrands[i]?.id
      if (originalId && createdId) {
        brandMap.set(originalId, createdId)
      }
    }

    // logo_url veya metadata güncellenmesi gerekiyorsa topluca güncelle
    if (
      (brandsWithLogo.length > 0 || brandsData.some((b: any) => b.id)) &&
      typeof brandModuleService.updateBrands === "function"
    ) {
      for (let i = 0; i < brandsData.length; i++) {
        const brand = brandsData[i]
        const createdBrandId = brandMap.get(brand.id)
        if (!createdBrandId) continue
        // Sadece logo_url ya da metadata güncellenmesi gerekiyorsa
        const updatePayload: any = {}
        if (brand.logo_url) updatePayload.logo_url = brand.logo_url
        // Güncelleme ile yeni metadata'yı oraya da ekle (id zaten ilk seferde eklenmiş olabilir)
        if (brand.id) {
          updatePayload.metadata = {
            ...(brand.metadata || {}),
            brand_id: brand.id,
          }
        }
        if (Object.keys(updatePayload).length === 0) continue // bir şey güncellenmeyecekse geç
        try {
          await brandModuleService.updateBrands({
            selector: { id: createdBrandId },
            data: updatePayload,
          })
        } catch (err: any) {
          if (brand.logo_url) {
            logoUpdateErrors.push(`Logo güncellenemedi (${brand.name}): ${err.message}`)
            logger.warn(`Failed to update brand logo for ${brand.name}: ${err.message}`)
          }
          if (brand.id) {
            // Diğer metadata update hatalarını da logla
            logger.warn(
              `Failed to update metadata for brand ${brand.name} (${brand.id}): ${err.message}`
            )
          }
        }
      }
    }

    res.json({
      success: true,
      message: `${createdBrands.length} marka bulk olarak oluşturuldu`,
      count: createdBrands.length,
      logo_update_errors: logoUpdateErrors.length > 0 ? logoUpdateErrors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/seed/brands
 * Tüm markaları siler (aynı şekilde tek tek, bulk yoksa eski gibi)
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const brandModuleService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    // Tüm markaları getir
    const brands = await brandModuleService.listBrands()

    if (!brands || brands.length === 0) {
      return res.json({
        success: true,
        message: "Silinecek marka bulunamadı",
        deleted_count: 0,
      })
    }

    let deletedCount = 0
    const errors: string[] = []

    // Önce tüm brand-product linklerini sil
    for (const brand of brands) {
      try {
        // Brand'e bağlı ürünleri getir
        const { data: brandData } = await query.graph({
          entity: "brand",
          fields: ["id", "product.id"],
          filters: {
            id: brand.id,
          },
        })

        const brandWithProducts = brandData[0]
        if (brandWithProducts?.product) {
          const products = Array.isArray(brandWithProducts.product)
            ? brandWithProducts.product
            : [brandWithProducts.product]

          // Tüm linkleri sil
          for (const product of products) {
            try {
              await remoteLink.dismiss({
                [Modules.PRODUCT]: {
                  product_id: product.id,
                },
                brand: {
                  brand_id: brand.id,
                },
              })
            } catch (error: any) {
              logger.warn(`Failed to dismiss link for product ${product.id}: ${error.message}`)
            }
          }
        }
      } catch (error: any) {
        logger.warn(`Failed to get products for brand ${brand.id}: ${error.message}`)
      }
    }

    // Bulk silme destekleniyorsa burada kullanılabilir
    if (typeof brandModuleService.deleteBrands === "function" && brands.length > 0) {
      for (const brand of brands) {
        try {
          await brandModuleService.deleteBrands(brand.id)
          deletedCount++
        } catch (error: any) {
          errors.push(`Marka ${brand.name} (${brand.id}) silinirken hata: ${error.message}`)
          logger.warn(`Failed to delete brand ${brand.name}: ${error.message}`)
        }
      }
    }

    res.json({
      success: errors.length === 0,
      message: `${deletedCount} marka silindi`,
      deleted_count: deletedCount,
      total_count: brands.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}
