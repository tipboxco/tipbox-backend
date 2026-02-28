import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../../../../modules/brand"
import BrandModuleService from "../../../../modules/brand/service"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

interface BrandCsvRow {
  name: string
  handle: string
  root_category_name: string
  second_category_name: string
  third_category_name: string
  website: string
  metadata: string
  rank: string
  ispopular: string
}

/**
 * POST /admin/seed/brands
 * Brands seed işlemini başlatır (bulk ekleme)
 * 1. Önce distinct root_category_name değerlerinden BrandCategory oluşturur
 * 2. Ardından brandleri eklerken category_id ataması yapar
 * 3. secondary_category_name ve third_category_name değerlerini metadata'ya ekler
 * 4. website değerini website_url alanına atar
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const brandModuleService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")

    // Brands CSV'yi oku (brands_2.csv)
    const brandsCsvPath = path.join(csvDataPath, "brands_2.csv")
    if (!fs.existsSync(brandsCsvPath)) {
      return res.status(404).json({ error: "Brands CSV dosyası bulunamadı (brands_2.csv)" })
    }

    const brandsCsvContent = fs.readFileSync(brandsCsvPath, "utf-8")
    const brandsData = Papa.parse<BrandCsvRow>(brandsCsvContent, {
      header: true,
      skipEmptyLines: true,
    }).data

    logger.info(`CSV'den ${brandsData.length} brand okundu`)

    // 1. Distinct root_category_name değerlerini al
    const distinctCategories = [
      ...new Set(
        brandsData
          .map((row) => row.root_category_name?.trim())
          .filter((name) => name && name.length > 0)
      ),
    ]

    logger.info(`${distinctCategories.length} farklı kategori bulundu: ${distinctCategories.join(", ")}`)

    // 2. BrandCategory'leri oluştur
    const categoryMap = new Map<string, string>() // root_category_name -> category_id

    // Önce mevcut kategorileri kontrol et
    const existingCategories = await brandModuleService.listBrandCategories()
    for (const cat of existingCategories) {
      categoryMap.set(cat.title, cat.id)
    }

    // Yeni kategorileri oluştur
    const newCategoriesToCreate = distinctCategories.filter((name) => !categoryMap.has(name))
    
    if (newCategoriesToCreate.length > 0) {
      const categoriesToCreate = newCategoriesToCreate.map((categoryName) => ({
        title: categoryName,
        handle: categoryName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        metadata: null,
      }))

      try {
        const createdCategories = await brandModuleService.createBrandCategories(categoriesToCreate)
        for (const cat of createdCategories) {
          categoryMap.set(cat.title, cat.id)
        }
        logger.info(`${createdCategories.length} yeni BrandCategory oluşturuldu`)
      } catch (err: any) {
        logger.error("BrandCategory oluşturulurken hata: " + err.message)
        return res.status(500).json({ error: "BrandCategory oluşturulurken hata: " + err.message })
      }
    }

    // 3. Brands'leri hazırla
    const brandsToCreate = brandsData.map((brandRow) => {
      // Metadata oluştur
      const metadataObj: Record<string, any> = {}
      
      // Mevcut metadata'yı parse et (eğer varsa)
      if (brandRow.metadata && brandRow.metadata.trim()) {
        try {
          const parsedMeta = JSON.parse(brandRow.metadata)
          Object.assign(metadataObj, parsedMeta)
        } catch {
          // JSON parse hatası, boş bırak
        }
      }

      // secondary ve third category bilgilerini metadata'ya ekle
      if (brandRow.second_category_name?.trim()) {
        metadataObj.second_category_name = brandRow.second_category_name.trim()
      }
      if (brandRow.third_category_name?.trim()) {
        metadataObj.third_category_name = brandRow.third_category_name.trim()
      }

      // Category ID'yi bul
      const categoryId = brandRow.root_category_name?.trim()
        ? categoryMap.get(brandRow.root_category_name.trim()) || null
        : null

      const website = brandRow.website?.trim();
      
      // rank değerini parse et (number veya null)
      let rank: number | null = null
      if (brandRow.rank?.trim()) {
        const parsedRank = parseInt(brandRow.rank.trim(), 10)
        if (!isNaN(parsedRank)) {
          rank = parsedRank
        }
      }
      
      // ispopular değerini parse et (boolean veya null)
      let ispopular: boolean | null = null
      if (brandRow.ispopular?.trim()) {
        const ispopularValue = brandRow.ispopular.trim().toLowerCase()
        if (ispopularValue === 'true' || ispopularValue === '1' || ispopularValue === 'yes') {
          ispopular = true
        } else if (ispopularValue === 'false' || ispopularValue === '0' || ispopularValue === 'no') {
          ispopular = false
        }
      }
      
      return {
        name: brandRow.name,
        handle: brandRow.handle || null,
        website_url: brandRow.website?.trim() || null,
        logo_url: website?.length > 0 ? `https://img.logo.dev/name/${website}?token=${process.env.LOGO_DEV_API_TOKEN}` : null,
        category_id: categoryId,
        rank: rank,
        ispopular: ispopular,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : null,
      }
    })

    // 4. Toplu ekle
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

    res.json({
      success: true,
      message: `${createdBrands.length} marka bulk olarak oluşturuldu`,
      count: createdBrands.length,
      categories_created: newCategoriesToCreate.length,
      total_categories: categoryMap.size,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/seed/brands
 * Tüm markaları ve brand kategorilerini siler
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
    const brandCategories = await brandModuleService.listBrandCategories()

    let deletedBrandCount = 0
    let deletedCategoryCount = 0
    const errors: string[] = []

    // Önce tüm brand-product linklerini sil
    if (brands && brands.length > 0) {
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

      // Tüm brandları sil
      if (typeof brandModuleService.deleteBrands === "function") {
        for (const brand of brands) {
          try {
            await brandModuleService.deleteBrands(brand.id)
            deletedBrandCount++
          } catch (error: any) {
            errors.push(`Marka ${brand.name} (${brand.id}) silinirken hata: ${error.message}`)
            logger.warn(`Failed to delete brand ${brand.name}: ${error.message}`)
          }
        }
      }
    }

    // Tüm brand kategorilerini sil
    if (brandCategories && brandCategories.length > 0) {
      if (typeof brandModuleService.deleteBrandCategories === "function") {
        for (const category of brandCategories) {
          try {
            await brandModuleService.deleteBrandCategories(category.id)
            deletedCategoryCount++
          } catch (error: any) {
            errors.push(`Kategori ${category.title} (${category.id}) silinirken hata: ${error.message}`)
            logger.warn(`Failed to delete brand category ${category.title}: ${error.message}`)
          }
        }
      }
    }

    res.json({
      success: errors.length === 0,
      message: `${deletedBrandCount} marka ve ${deletedCategoryCount} kategori silindi`,
      deleted_brand_count: deletedBrandCount,
      deleted_category_count: deletedCategoryCount,
      total_brand_count: brands?.length || 0,
      total_category_count: brandCategories?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}
