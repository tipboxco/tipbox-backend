import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SYNC_MANAGER_MODULE } from "../../../../../modules/sync-manager"
import { BRAND_MODULE } from "../../../../../modules/brand"
import type SyncManagerService from "../../../../../modules/sync-manager/service"
import type BrandModuleService from "../../../../../modules/brand/service"
import { ModuleType, SyncPayload } from "../../../../../modules/sync-manager/types"

/**
 * POST /admin/sync/:id/run
 * Sync işlemini başlatır
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const syncManager = req.scope.resolve<SyncManagerService>(SYNC_MANAGER_MODULE)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { id } = req.params

    // Config'i getir
    const config = await syncManager.retrieveSyncConfig(id)

    if (!config) {
      return res.status(404).json({ error: "Sync config bulunamadı" })
    }

    if (!config.is_active) {
      return res.status(400).json({ error: "Bu sync config aktif değil" })
    }

    // Çalışan job var mı kontrol et
    const hasRunning = await syncManager.hasRunningJob(id)
    if (hasRunning) {
      return res.status(400).json({ error: "Bu sync config için zaten çalışan bir job var" })
    }

    // Veri sayısını al
    const totalRecords = await getRecordCount(config.module_type as ModuleType, query, req.scope)

    if (totalRecords === 0) {
      return res.status(400).json({ error: "Senkronize edilecek veri bulunamadı" })
    }

    // Batch boyutunu sınırla - çok büyük batch'ler kilitlenmeye neden olur
    const batchSize = Math.min(config.batch_size || 100, 100) // Max 100 kayıt per batch
    const totalBatches = Math.ceil(totalRecords / batchSize)

    // Job oluştur
    const job = await syncManager.createJob({
      sync_config_id: id,
      total_records: totalRecords,
      total_batches: totalBatches,
      metadata: {
        batch_size: batchSize,
        module_type: config.module_type,
      },
    })

    // Response'u HEMEN gönder
    res.json({
      message: "Sync başlatıldı",
      job_id: job.id,
      total_records: totalRecords,
      total_batches: totalBatches,
      batch_size: batchSize,
    })

    // Sync context'i sakla
    const syncContext: SyncContext = {
      syncManager,
      query,
      productService: req.scope.resolve(Modules.PRODUCT),
      brandService: (config.module_type === "brand" || config.module_type === "brand_category") 
        ? req.scope.resolve(BRAND_MODULE) as BrandModuleService 
        : null,
    }

    // Background işlemi TAMAMEN detach et - setTimeout ile
    setTimeout(() => {
      runSyncInBackground(
        syncContext,
        config,
        job.id,
        totalRecords,
        batchSize,
        totalBatches
      ).catch(error => {
        console.error(`[Sync] Background sync error: ${error}`)
      })
    }, 0)

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * Modül tipine göre kayıt sayısını döndürür
 */
async function getRecordCount(
  moduleType: ModuleType,
  query: any,
  scope: any
): Promise<number> {
  switch (moduleType) {
    case "product": {
      // Product service ile count al - daha performanslı
      const productService = scope.resolve(Modules.PRODUCT)
      const [, count] = await productService.listAndCountProducts({}, { take: 0 })
      return count
    }
    case "category": {
      // TÜM kategorileri say - hiçbir filtre yok
      const { data } = await query.graph({
        entity: "product_category",
        fields: ["id"],
      })
      const count = data?.length || 0
      console.log(`[Sync] Total categories count: ${count}`)
      return count
    }
    case "brand": {
      const brandService = scope.resolve(BRAND_MODULE) as BrandModuleService
      const brands = await brandService.listBrands()
      return brands.length
    }
    case "brand_category": {
      const brandService = scope.resolve(BRAND_MODULE) as BrandModuleService
      const brandCategories = await brandService.listBrandCategories()
      return brandCategories.length
    }
    default:
      return 0
  }
}

/**
 * Event loop'a kontrol verir
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Belirli süre bekler
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Job iptal kontrolü
 */
async function isJobCancelled(syncManager: SyncManagerService, jobId: string): Promise<boolean> {
  try {
    const job = await syncManager.retrieveSyncJob(jobId)
    return job?.status === "cancelled"
  } catch {
    return false
  }
}

type SyncContext = {
  syncManager: SyncManagerService
  query: any
  productService: any
  brandService: BrandModuleService | null
}

/**
 * Catalog service module_type'ını backend'in beklediği formata dönüştürür
 * brand_category -> brand-categories (backend "brand-categories" bekliyor)
 */
function mapModuleTypeForBackend(moduleType: ModuleType): string {
  if (moduleType === "brand_category") {
    return "brand-categories"
  }
  return moduleType
}

// Category sıralı cache - job bazında
const categoryCache = new Map<string, CategoryWithLevel[]>()

interface CategoryWithLevel {
  id: string
  name: string
  description: string | null
  handle: string
  is_active: boolean
  is_internal: boolean
  rank: number | null
  parent_category_id: string | null // DB'den gelen field
  parent_id: string | null // Response'da gönderilecek field
  metadata: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
  level: number
}

/**
 * Kategorileri parent-child ilişkisine göre sıralar (level bazlı)
 * Level 0: parent_id = null (ana kategoriler)
 * Level 1: parent_id = level 0 kategorilerin id'si
 * Level 2: parent_id = level 1 kategorilerin id'si
 * vs.
 * 
 * Tüm kategoriler katman katman gönderilir - hiçbiri atlanmaz
 */
function sortCategoriesByLevel(
  categories: CategoryWithLevel[]
): CategoryWithLevel[] {
  // Level hesaplama fonksiyonu - circular reference koruması ile
  const calculateLevel = (
    category: CategoryWithLevel,
    allCategories: CategoryWithLevel[],
    visited: Set<string> = new Set()
  ): number => {
    // Circular reference kontrolü
    if (visited.has(category.id)) {
      console.warn(`[Sync] Circular reference detected for category ${category.id}, treating as level 0`)
      return 0
    }

    // parent_category_id'yi parent_id'ye map et
    const parentId = category.parent_category_id

    if (!parentId) {
      return 0
    }

    const parent = allCategories.find(c => c.id === parentId)
    if (!parent) {
      return 0 // Parent bulunamazsa level 0 kabul et
    }

    // Parent'ın level'ını recursive olarak hesapla
    visited.add(category.id)
    const level = calculateLevel(parent, allCategories, visited) + 1
    visited.delete(category.id)

    return level
  }

  // Her kategoriye level ekle ve parent_id'yi map et
  const categoriesWithLevel = categories.map(cat => {
    const level = calculateLevel(cat, categories)
    return {
      ...cat,
      level,
      parent_id: cat.parent_category_id, // parent_category_id'yi parent_id olarak map et
    }
  })

  // Level'a göre sırala (önce level 0, sonra 1, 2, vs.)
  // Aynı level içinde rank'a göre sırala
  const sorted = categoriesWithLevel.sort((a, b) => {
    // Önce level'a göre
    if (a.level !== b.level) {
      return a.level - b.level
    }
    // Aynı level'da rank'a göre
    const rankA = a.rank ?? 0
    const rankB = b.rank ?? 0
    if (rankA !== rankB) {
      return rankA - rankB
    }
    // Aynı rank'ta name'e göre
    return a.name.localeCompare(b.name)
  })

  console.log(`[Sync] Sorted ${sorted.length} categories by level:`, {
    byLevel: sorted.reduce((acc, cat) => {
      acc[`level_${cat.level}`] = (acc[`level_${cat.level}`] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  })

  return sorted
}

/**
 * Kategorileri parent-child sırasına göre getirir ve cache'ler
 * TÜM kategorileri çeker - hiçbiri atlanmaz
 */
async function getSortedCategories(
  context: SyncContext,
  jobId: string
): Promise<CategoryWithLevel[]> {
  // Cache'de varsa direkt döndür
  if (categoryCache.has(jobId)) {
    const cached = categoryCache.get(jobId)!
    console.log(`[Sync] Using cached categories for job ${jobId}: ${cached.length} categories`)
    return cached
  }

  console.log(`[Sync] Fetching all categories for job ${jobId}...`)

  // TÜM kategorileri çek - hiçbir filtre yok
  const { data: allCategories } = await context.query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "description",
      "handle",
      "is_active",
      "is_internal",
      "rank",
      "parent_category_id",
      "metadata",
      "created_at",
      "updated_at",
      "mpath"
    ],
  })

  console.log(`[Sync] Fetched ${allCategories?.length || 0} categories from database`)

  if (!allCategories || allCategories.length === 0) {
    console.warn(`[Sync] No categories found for job ${jobId}`)
    return []
  }

  // Parent-child sırasına göre sırala
  const sorted = sortCategoriesByLevel(allCategories as CategoryWithLevel[])

  // Cache'e kaydet
  categoryCache.set(jobId, sorted)

  console.log(`[Sync] Categories sorted and cached for job ${jobId}:`, {
    total: sorted.length,
    byLevel: sorted.reduce((acc, cat) => {
      acc[`level_${cat.level}`] = (acc[`level_${cat.level}`] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  })

  return sorted
}

/**
 * Modül tipine göre verileri batch halinde getirir - DATABASE PAGINATION
 * skip: offset, take: limit kullanarak doğrudan DB'den çeker
 * Category için parent-child sıralaması uygulanır
 */
async function getRecordsBatch(
  moduleType: ModuleType,
  context: SyncContext,
  offset: number,
  limit: number,
  jobId?: string
): Promise<unknown[]> {
  // Event loop'a kontrol ver
  await yieldToEventLoop()

  switch (moduleType) {
    case "product": {

      // 'name' column does not exist in 'product' table, remove ordering by name to prevent error
      const { data: products } = await context.query.graph({
        entity: "product",
        pagination: {
          skip: offset,
          take: limit,
          // order: {
          //   name: "DESC",
          // }
        },
        fields: [
          "id",
          "title",
          "subtitle",
          "handle",
          "status",
          "thumbnail",
          "description",
          "weight",
          "metadata",
          "created_at",
          "updated_at",
          "brand_id",
          "categories.id",
          "brand.id",
          "brand.name",
          "brand.logo_url",
          "images.*"
        ],
      })

      // Her bir ürün için brand ve category bilgisi uygun formata oturtuluyor
      const productsWithCategoryAndBrand = products.map((product: any) => ({
        ...product,
        category_id: Array.isArray(product.categories) && product.categories.length > 0
          ? product.categories[0].id
          : null,
        brand_id: product.brand_id || (product.brand ? product.brand.id : null),
      }))
      console.log(`[Sync] Products: ${JSON.stringify(productsWithCategoryAndBrand)}`)
      return productsWithCategoryAndBrand
    }
    case "category": {
      if (!jobId) {
        throw new Error("jobId required for category sync")
      }

      // Parent-child sıralamasına göre sıralı kategorileri al (TÜM kategoriler)
      const sortedCategories = await getSortedCategories(context, jobId)

      // Sıralı listeden batch slice al
      const batch = sortedCategories.slice(offset, offset + limit)

      // Response'da parent_id kullan (parent_category_id yerine)
      const batchWithParentId = batch.map(cat => {
        const { parent_category_id, ...rest } = cat
        return {
          ...rest,
          parent_id: parent_category_id, // parent_category_id'yi parent_id olarak gönder
        }
      })

      console.log(`[Sync] Category batch ${offset}-${offset + limit}: ${batchWithParentId.length} categories (levels: ${[...new Set(batch.map(c => c.level))].join(', ')})`)

      return batchWithParentId
    }
    case "brand": {
      if (!context.brandService) return []
      // Brand service ile pagination - category ilişkisi dahil
      const brands = await context.brandService.listBrands(
        {}, // filters
        {
          skip: offset,
          take: limit,
          relations: ["category"], // category ilişkisini çek
        }
      )
      return brands.map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        handle: brand.handle || null,
        website_url: brand.website_url || null,
        logo_url: brand.logo_url || null,
        banner_url: brand.banner_url || null,
        rank: brand.rank ?? null,
        ispopular: brand.ispopular ?? null,
        metadata: brand.metadata || null,
        tags: brand.tags || null,
        // Backend category ismi (string) ile eşleştirme yapıyor
        category: brand.category?.title || null, // Kategori ismi (backend bu değeri kullanarak categoryId buluyor)
        category_id: brand.category?.id || brand.category_id || null, // Fallback olarak direkt ID
        created_at: brand.created_at,
        updated_at: brand.updated_at,
      }))
    }
    case "brand_category": {
      if (!context.brandService) return []
      // Brand category service ile pagination
      const brandCategories = await context.brandService.listBrandCategories()
      
      // Manuel pagination (service'de pagination desteği yoksa)
      const paginatedCategories = brandCategories.slice(offset, offset + limit)
      
      // Backend "brand-categories" modül tipinde name field'ı bekliyor
      return paginatedCategories.map((category: any) => ({
        id: category.id,
        name: category.title, // Backend'in beklediği field (name)
        title: category.title, // Orijinal field da gönder
        thumbnail: category.thumbnail || null,
        image_url: category.thumbnail || null, // Backend alternatif olarak image_url de kabul ediyor
        metadata: category.metadata || null,
        created_at: category.created_at,
        updated_at: category.updated_at,
      }))
    }
    default:
      return []
  }
}

/**
 * Sync işlemini background'da çalıştırır
 */
async function runSyncInBackground(
  context: SyncContext,
  config: any,
  jobId: string,
  totalRecords: number,
  batchSize: number,
  totalBatches: number
): Promise<void> {
  const { syncManager } = context

  try {
    // Job'ı başlat
    await syncManager.startJob(jobId)

    // Category için cache'i önceden yükle - tüm kategorileri çek ve sırala
    if (config.module_type === "category") {
      console.log(`[Sync] Pre-loading categories for job ${jobId}...`)
      await getSortedCategories(context, jobId)
      console.log(`[Sync] Categories pre-loaded for job ${jobId}`)
    }

    let totalProcessed = 0
    let totalFailed = 0
    const timestamp = new Date().toISOString()

    console.log(`[Sync] Starting job ${jobId}: ${totalRecords} records in ${totalBatches} batches`)

    // Her batch için
    for (let batch = 1; batch <= totalBatches; batch++) {
      // Event loop'a kontrol ver - ÖNEMLİ
      await delay(10)

      // İptal kontrolü
      if (await isJobCancelled(syncManager, jobId)) {
        console.log(`[Sync] Job ${jobId} cancelled at batch ${batch}/${totalBatches}`)
        // Cache'i temizle
        categoryCache.delete(jobId)
        return
      }

      const offset = (batch - 1) * batchSize

      try {
        // Veriyi getir (category için jobId gerekli - parent-child sıralaması için)
        const records = await getRecordsBatch(
          config.module_type as ModuleType,
          context,
          offset,
          batchSize,
          jobId
        )

        if (records.length === 0) {
          await syncManager.updateBatchProgress(jobId, batch, totalProcessed, totalFailed)
          continue
        }

        // Event loop'a kontrol ver
        await delay(5)

        // Payload oluştur - küçük batch boyutu ile
        // Backend farklı module_type formatı bekliyor (brand_category -> brand-categories)
        const payload: SyncPayload = {
          sync_id: config.id,
          job_id: jobId,
          module_type: mapModuleTypeForBackend(config.module_type as ModuleType) as ModuleType,
          batch_number: batch,
          total_batches: totalBatches,
          batch_size: batchSize,
          total_records: totalRecords,
          data: records,
          timestamp,
        }

        // Event loop'a kontrol ver (JSON.stringify öncesi)
        await delay(5)

        // Batch'i gönder
        const result = await syncManager.sendBatch(
          config.target_url,
          config.secret_token,
          payload
        )

        totalProcessed += result.processed
        totalFailed += result.failed

        // İlerlemeyi güncelle
        await syncManager.updateBatchProgress(jobId, batch, totalProcessed, totalFailed)

        console.log(`[Sync] Batch ${batch}/${totalBatches}: ${result.processed} OK, ${result.failed} failed`)

      } catch (batchError) {
        console.error(`[Sync] Batch ${batch} error:`, batchError)
        totalFailed += batchSize
        await syncManager.updateBatchProgress(jobId, batch, totalProcessed, totalFailed)
      }

      // Batch arası bekleme - event loop için
      await delay(50)
    }

    // Son iptal kontrolü
    if (await isJobCancelled(syncManager, jobId)) {
      console.log(`[Sync] Job ${jobId} was cancelled before completion`)
      // Cache'i temizle
      categoryCache.delete(jobId)
      return
    }

    // Job'ı tamamla
    await syncManager.completeJob(jobId, totalProcessed, totalFailed)
    await syncManager.updateLastSyncTime(config.id)

    // Cache'i temizle
    categoryCache.delete(jobId)

    console.log(`[Sync] Job ${jobId} completed: ${totalProcessed} processed, ${totalFailed} failed`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Cache'i temizle
    categoryCache.delete(jobId)

    if (await isJobCancelled(syncManager, jobId)) {
      return
    }

    await syncManager.failJob(jobId, errorMessage)
    console.error(`[Sync] Job ${jobId} failed: ${errorMessage}`)
  }
}
