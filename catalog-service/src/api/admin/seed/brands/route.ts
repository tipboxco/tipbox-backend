import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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

const CHUNK_SIZE = 500
const BATCH_SIZE = 250

/**
 * POST /admin/seed/brands
 * Brands seed işlemini başlatır (stream + batch ekleme)
 * 1. Önce CSV stream ile okunup distinct root_category_name değerleri toplanır
 * 2. BrandCategory'ler oluşturulur
 * 3. CSV tekrar stream ile okunup batch halinde brandler oluşturulur
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const brandModuleService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")

    const brandsCsvPath = path.join(csvDataPath, "brands_2.csv")
    if (!fs.existsSync(brandsCsvPath)) {
      return res.status(404).json({ error: "Brands CSV dosyası bulunamadı (brands_2.csv)" })
    }

    // 1. İlk geçiş: distinct category isimlerini topla (bellekte sadece string set tutulur)
    const distinctCategories = new Set<string>()
    let totalRows = 0

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(brandsCsvPath, {
        encoding: "utf-8",
        highWaterMark: CHUNK_SIZE * 1024,
      })
      Papa.parse<BrandCsvRow>(readStream, {
        header: true,
        skipEmptyLines: true,
        chunk: (results: Papa.ParseResult<BrandCsvRow>) => {
          for (const row of results.data) {
            totalRows++
            const catName = row.root_category_name?.trim()
            if (catName && catName.length > 0) {
              distinctCategories.add(catName)
            }
          }
        },
        complete: () => resolve(),
        error: (err: Error) => reject(err),
      })
    })

    logger.info(`CSV'den ${totalRows} brand okundu`)
    logger.info(`${distinctCategories.size} farklı kategori bulundu: ${[...distinctCategories].join(", ")}`)

    // 2. BrandCategory'leri oluştur
    const categoryMap = new Map<string, string>()

    const existingCategories = await brandModuleService.listBrandCategories()
    for (const cat of existingCategories) {
      categoryMap.set(cat.title, cat.id)
    }

    const newCategoriesToCreate = [...distinctCategories].filter((name) => !categoryMap.has(name))

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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.error("BrandCategory oluşturulurken hata: " + errMsg)
        return res.status(500).json({ error: "BrandCategory oluşturulurken hata: " + errMsg })
      }
    }

    // 3. İkinci geçiş: CSV'yi tekrar stream ile oku, batch halinde brandleri oluştur
    if (typeof brandModuleService.createBrands !== "function") {
      return res.status(500).json({ error: "brandModuleService.createBrands bulk metodu bulunamadı" })
    }

    let createdBrandsCount = 0
    let failedBatches = 0
    let pendingRows: BrandCsvRow[] = []
    let batchIndex = 0

    const prepareBrand = (brandRow: BrandCsvRow) => {
      const metadataObj: Record<string, string> = {}

      if (brandRow.metadata && brandRow.metadata.trim()) {
        try {
          const parsedMeta = JSON.parse(brandRow.metadata)
          Object.assign(metadataObj, parsedMeta)
        } catch { }
      }

      if (brandRow.second_category_name?.trim()) {
        metadataObj.second_category_name = brandRow.second_category_name.trim()
      }
      if (brandRow.third_category_name?.trim()) {
        metadataObj.third_category_name = brandRow.third_category_name.trim()
      }

      const categoryId = brandRow.root_category_name?.trim()
        ? categoryMap.get(brandRow.root_category_name.trim()) || null
        : null

      const website = brandRow.website?.trim()

      let rank: number | null = null
      if (brandRow.rank?.trim()) {
        const parsedRank = parseInt(brandRow.rank.trim(), 10)
        if (!isNaN(parsedRank)) {
          rank = parsedRank
        }
      }

      let ispopular: boolean | null = null
      if (brandRow.ispopular?.trim()) {
        const ispopularValue = brandRow.ispopular.trim().toLowerCase()
        if (ispopularValue === "true" || ispopularValue === "1" || ispopularValue === "yes") {
          ispopular = true
        } else if (ispopularValue === "false" || ispopularValue === "0" || ispopularValue === "no") {
          ispopular = false
        }
      }

      return {
        name: brandRow.name,
        handle: brandRow.handle || null,
        website_url: brandRow.website?.trim() || null,
        logo_url: website && website.length > 0
          ? `https://img.logo.dev/name/${website}?token=${process.env.LOGO_DEV_API_TOKEN}`
          : null,
        category_id: categoryId,
        rank,
        ispopular,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : null,
      }
    }

    const processBatch = async (rows: BrandCsvRow[]) => {
      batchIndex++
      const brandsToCreate = rows.map(prepareBrand)

      try {
        const created = await brandModuleService.createBrands(brandsToCreate)
        createdBrandsCount += created.length
      } catch (err: unknown) {
        failedBatches++
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.warn(`[Brand Batch ${batchIndex}] ${rows.length} brand oluşturulurken hata: ${errMsg}`)
      }

      if (batchIndex % 10 === 0) {
        logger.info(`Brand ilerleme: ${createdBrandsCount} oluşturuldu (batch ${batchIndex})`)
      }
    }

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(brandsCsvPath, {
        encoding: "utf-8",
        highWaterMark: CHUNK_SIZE * 1024,
      })
      Papa.parse<BrandCsvRow>(readStream, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results: Papa.ParseResult<BrandCsvRow>, parser: Papa.Parser) => {
          pendingRows.push(...results.data)

          while (pendingRows.length >= BATCH_SIZE) {
            const batch = pendingRows.splice(0, BATCH_SIZE)
            parser.pause()
            await processBatch(batch)
            parser.resume()
          }
        },
        complete: async () => {
          if (pendingRows.length > 0) {
            await processBatch(pendingRows)
            pendingRows = []
          }
          resolve()
        },
        error: (err: Error) => reject(err),
      })
    })

    res.json({
      success: true,
      message: `${createdBrandsCount} marka batch halinde oluşturuldu`,
      count: createdBrandsCount,
      failed_batches: failedBatches,
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
 *
 * Optimize: Raw SQL ile bulk delete — 23.000+ DB sorgusu yerine 5 sorgu
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    // Count'ları al
    const brandCountResult = await pgConnection.raw("SELECT count(*)::int AS cnt FROM brand")
    const categoryCountResult = await pgConnection.raw("SELECT count(*)::int AS cnt FROM brand_category")
    const brandCount = brandCountResult.rows?.[0]?.cnt ?? brandCountResult[0]?.[0]?.cnt ?? 0
    const categoryCount = categoryCountResult.rows?.[0]?.cnt ?? categoryCountResult[0]?.[0]?.cnt ?? 0

    if (brandCount === 0 && categoryCount === 0) {
      return res.json({
        success: true,
        message: "Silinecek brand veya kategori bulunamadı",
        deleted_brand_count: 0,
        deleted_category_count: 0,
      })
    }

    logger.info(`[Seed DELETE] ${brandCount} brand ve ${categoryCount} kategori silinecek...`)

    // 1. Brand-product linklerini sil
    await pgConnection.raw("DELETE FROM product_product_brand_brand")
    logger.info("[Seed DELETE] Brand-product linkleri silindi")

    // 2. Tüm brandleri sil
    await pgConnection.raw("DELETE FROM brand")
    logger.info(`[Seed DELETE] ${brandCount} brand silindi`)

    // 3. Tüm brand kategorilerini sil
    await pgConnection.raw("DELETE FROM brand_category")
    logger.info(`[Seed DELETE] ${categoryCount} kategori silindi`)

    res.json({
      success: true,
      message: `${brandCount} marka ve ${categoryCount} kategori silindi`,
      deleted_brand_count: brandCount,
      deleted_category_count: categoryCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}
