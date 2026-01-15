import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"
import slugify from "slugify"

/**
 * POST /admin/seed/products
 * Products seed işlemini başlatır
 *
 * Büyük veri alımı için optimize edilmiştir.
 */

const PRODUCT_BRAND_LINK_QUERY =    `DELETE FROM product_product_brand_brand;
DO $$ 
BEGIN
    -- 1. ADIM: İndekslerin Hazırlanması (Eğer yoksa)
    -- Ara tablo (Link tablosu) için performans indeksleri
    CREATE INDEX IF NOT EXISTS idx_link_product_id ON public.product_product_brand_brand (product_id);
    CREATE INDEX IF NOT EXISTS idx_link_brand_id ON public.product_product_brand_brand (brand_id);

    -- 2. ADIM: Geçici Eşleşme Tablosu
    -- Burada p.id ve b.id ikilisini alıyoruz. 
    -- DISTINCT kullanmıyoruz ki tüm ürün-marka kombinasyonları gelsin.
    CREATE TEMP TABLE tmp_brand_matches AS
    SELECT 
        p.id AS p_id, 
        b.id AS b_id
    FROM public.product p
    INNER JOIN public.brand b ON 
        TRIM(LOWER(TRANSLATE(p.metadata->>'brand', 'âçğıİîöşüûÂÇĞİÎÖŞÜÛ', 'acgiioosuuaCGIiooSUU'))) = 
        TRIM(LOWER(TRANSLATE(b.name, 'âçğıİîöşüûÂÇĞİÎÖŞÜÛ', 'acgiioosuuaCGIiooSUU')))
    WHERE 
        p.metadata->>'brand' IS NOT NULL;

    -- 3. ADIM: Hatalı Linklerin Temizlenmesi
    -- Sadece ürünün metadata'sındaki marka ile tablodaki marka UYUŞMUYORSA siler.
    DELETE FROM public.product_product_brand_brand link
    USING public.product p, public.brand b
    WHERE link.product_id = p.id 
      AND link.brand_id = b.id
      AND TRIM(LOWER(TRANSLATE(p.metadata->>'brand', 'âçğıİîöşüûÂÇĞİÎÖŞÜÛ', 'acgiioosuuaCGIiooSUU'))) 
          != TRIM(LOWER(TRANSLATE(b.name, 'âçğıİîöşüûÂÇĞİÎÖŞÜÛ', 'acgiioosuuaCGIiooSUU')));

    -- 4. ADIM: Çoklu Ekleme (Bulk Insert)
    -- Burada can alıcı nokta: Sadece AYNI ürün-marka çifti varsa eklemiyoruz.
    -- Bir marka 100 farklı ürüne bu sayede bağlanabilir.
    INSERT INTO public.product_product_brand_brand (id, product_id, brand_id, created_at, updated_at)
    SELECT 
        'link_' || gen_random_uuid(),
        t.p_id,
        t.b_id,
        NOW(),
        NOW()
    FROM tmp_brand_matches t
    WHERE NOT EXISTS (
        -- Kontrolü daraltıyoruz: Sadece bu spesifik eşleşme var mı?
        SELECT 1 
        FROM public.product_product_brand_brand existing 
        WHERE existing.product_id = t.p_id 
          AND existing.brand_id = t.b_id
    );

    -- Temizlik
    DROP TABLE tmp_brand_matches;
END $$;`;


export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")

    const productsCsvPath = path.join(csvDataPath, "products_with_images.csv")
    if (!fs.existsSync(productsCsvPath)) {
      return res.status(404).json({ error: "Products CSV dosyası bulunamadı" })
    }

    const productsCsvContent = fs.readFileSync(productsCsvPath, "utf-8")
    const productsData = Papa.parse(productsCsvContent, {
      header: true,
      skipEmptyLines: true,
    }).data as any[]

    const defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
      name: "Default Sales Channel",
    })
    if (!defaultSalesChannel.length) {
      return res.status(400).json({ error: "Default Sales Channel bulunamadı" })
    }

    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
      type: "default",
    })
    if (!shippingProfiles.length) {
      return res.status(400).json({ error: "Default Shipping Profile bulunamadı" })
    }
    const shippingProfile = shippingProfiles[0]

    // Category map'i oluştur - metadata'daki categoryid ile eşleştir
    const categoryMap = new Map<string, string>()
    const { data: existingCategories } = await query.graph({
      entity: "product_category",
      fields: ["id", "metadata"],
    })

    for (const category of existingCategories) {
      const categoryId = category.metadata?.categoryid
      if (categoryId && typeof categoryId === "string") {
        categoryMap.set(categoryId, category.id)
      }
    }

    // Brand map'i oluştur - metadata'daki brand_id eşleşmesi için
    const brandMap = new Map<string, string>()
    const { data: existingBrands } = await query.graph({
      entity: "brand",
      fields: ["id", "metadata"],
    })

    for (const brand of existingBrands) {
      const brandIdValue = brand.metadata?.brand_id
      if (brandIdValue && typeof brandIdValue === "string") {
        // brand_id => id eşleşmesi
        brandMap.set(brandIdValue, brand.id)
      }
    }

    logger.info(
      `Brand map oluşturuldu: ${brandMap.size} brand eşleşmesi bulundu (toplam ${existingBrands.length} brand)`
    )

    const handleSet = new Set<string>()
    let createdProducts = 0

    // CSV'deki toplam brand_id sayısını hesapla (istatistik için)
    let totalProductsWithBrandId = 0
    let totalProductsWithBrandIdInCsv = 0
    let brandIdNotInMapCount = 0
    const uniqueBrandIdsInCsv = new Set<string>()

    for (const productRow of productsData) {
      if (productRow.brand_id) {
        totalProductsWithBrandIdInCsv++
        uniqueBrandIdsInCsv.add(productRow.brand_id)
        const brandMapId = brandMap.get(productRow.brand_id)
        if (brandMapId) {
          totalProductsWithBrandId++
        } else {
          brandIdNotInMapCount++
        }
      }
    }

    logger.info(
      `CSV Analizi: ${totalProductsWithBrandIdInCsv} ürün için brand_id var, ` +
      `${totalProductsWithBrandId} ürün için brandMap'te eşleşme bulundu, ` +
      `${brandIdNotInMapCount} ürün için brandMap'te eşleşme bulunamadı ` +
      `(${uniqueBrandIdsInCsv.size} farklı brand_id değeri)`
    )

    const BATCH_SIZE = 250
    let batches: any[][] = []
    for (let i = 0; i < productsData.length; i += BATCH_SIZE) {
      batches.push(productsData.slice(i, i + BATCH_SIZE))
    }

    function makeHandle(row: any): string {
      let baseHandle = ""
      if (row.title) {
        baseHandle = slugify(row.title, {
          lower: true,
          strict: true,
          trim: true,
        }).substring(0, 90)
        baseHandle = baseHandle.replace(/-+$/, "")
      }
      if (!baseHandle) {
        const safeId = slugify(String(row.id || "product"), {
          lower: true,
          strict: true,
          trim: true,
        }).replace(/-+$/, "")
        baseHandle = `product-${safeId}`
      }
      let handle = baseHandle
      let counter = 1
      while (handleSet.has(handle)) {
        handle = `${baseHandle}-${counter}`
        counter++
      }
      handleSet.add(handle)
      return handle
    }

    const prepareProduct = (productRow: any) => {
      let categoryIds: string[] = []
      if (productRow.category_ids) {
        try {
          const parsed = JSON.parse(productRow.category_ids)
          if (Array.isArray(parsed)) {
            categoryIds = parsed
              .map((catId: string) => categoryMap.get(catId))
              .filter((id: string | undefined) => id !== undefined && id !== "") as string[]
          }
        } catch { }
      }

      // Brand link ürün create sırasında EKLENMEYECEK, sadece metadata'da tutulacak, SQL script ile linking yapılacak
      // Dolayısıyla brand_id döndürelim ama productObj'ye eklemeyelim
      let brand_id: string | undefined
      if (productRow.brand_id) {
        const brandMapId = brandMap.get(productRow.brand_id)
        if (brandMapId) {
          brand_id = brandMapId
        }
      }

      let images: { url: string }[] = []
      if (productRow.thumbnail) {
        images.push({ url: productRow.thumbnail })
      }
      if (productRow.images) {
        try {
          const parsed = JSON.parse(productRow.images)
          if (Array.isArray(parsed)) {
            parsed.forEach((imgUrl: string) => {
              if (imgUrl && !images.some(i => i.url === imgUrl)) {
                images.push({ url: imgUrl })
              }
            })
          }
        } catch { }
      }

      let metadata = null
      if (productRow.metadata) {
        try {
          metadata = JSON.parse(productRow.metadata)
        } catch { }
      }

      const productObj: any = {
        title: (productRow.title || "").substring(0, 255),
        description: productRow.description || "",
        handle: makeHandle(productRow),
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        category_ids: categoryIds,
        images,
        metadata,
        "options": [
          {
            "title": "Default option",
            "values": ["Default option value"]
          }
        ],
        variants: [],
        sales_channels: [
          {
            id: defaultSalesChannel[0].id,
          },
        ],
      }

      // brand_id'yi productObj'ye ekleme. Sadece referans için döndürüyoruz (linking SQL ile olacak).
      return { productObj, brand_id }
    }

    let failedBatches = 0

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const productsToCreate: any[] = []
      const failedProducts: string[] = []

      for (const productRow of batch) {
        try {
          const { productObj } = prepareProduct(productRow)
          if (productObj.handle && !/^[a-z0-9-]+$/.test(productObj.handle)) {
            logger.warn(
              `[Ürün Hazırlama Hatası] Handle URL-safe değil: "${productObj.handle}" (Ürün: ${productRow.title || productRow.id})`
            )
          }
          productsToCreate.push(productObj)
        } catch (error: any) {
          const productInfo = `"${productRow.title || "Başlıksız"}" (ID: ${productRow.id})`
          logger.warn(
            `[Ürün Hazırlama Hatası] Ürün hazırlanırken hata: ${productInfo} - Hata: ${error.message}`
          )
          failedProducts.push(productInfo)
        }
      }

      if (productsToCreate.length > 0) {
        try {
          const { result: createdProductsResult } = await createProductsWorkflow(container).run({
            input: {
              products: productsToCreate,
            },
          })
          createdProducts += createdProductsResult.length

        } catch (err: any) {
          failedBatches++
          const batchErrorMsg = String(err?.message || err)
          const batchInfo = `Batch ${i + 1}/${batches.length} (${productsToCreate.length} ürün)`

          if (batchErrorMsg.includes("Invalid product handle")) {
            const handleMatch = batchErrorMsg.match(/Invalid product handle ['"]([^'"]+)['"]/)
            const invalidHandle = handleMatch ? handleMatch[1] : "bilinmeyen"
            logger.warn(
              `[Batch Oluşturma Hatası] ${batchInfo} - Handle URL-safe değil: "${invalidHandle}". ` +
              `Handle yalnızca küçük harf, rakam ve tire (-) içerebilir. Alt çizgi (_) ve diğer özel karakterler kullanılamaz.`
            )
          } else if (
            batchErrorMsg.includes("Option value") &&
            batchErrorMsg.includes("does not exist")
          ) {
            logger.warn(
              `[Batch Oluşturma Hatası] ${batchInfo} - Variant option hatalı/eksik tanımlandı. ` +
              `Option values alanı ile options objeleri tam eşleşmeli! Her bir ürün 'options' içinde option title ve 'values' alanını, ayrıca 'variants' için options obje formatında value sağlamalı (örn: { Size: "Default" }). ` +
              `Hata detayı: ${batchErrorMsg}`
            )
          } else if (batchErrorMsg.includes("Product options are not provided")) {
            logger.warn(
              `[Batch Oluşturma Hatası] ${batchInfo} - Ürün seçenekleri (options) tanımlanmamış. ` +
              `Her ürün için en az bir option tanımlanmalı. Hata detayı: ${batchErrorMsg}`
            )
          } else {
            logger.warn(
              `[Batch Oluşturma Hatası] ${batchInfo} - ${batchErrorMsg}`
            )
          }

          if (failedProducts.length > 0) {
            logger.warn(
              `[Batch ${i + 1}] Hazırlanamayan ürünler: ${failedProducts.join(", ")}`
            )
          }
        }
      }

      if ((i + 1) % Math.max(1, Math.floor(batches.length / 20)) === 0) {
        logger.info(
          `İlerleme: ${createdProducts} / ${productsData.length} ürün oluşturuldu. ${failedBatches} batch başarısız oldu.`
        )
      }
    }

    // SQL ile batching sonunda product-brand linklerini batch linkleme işlemi
    logger.info("Ürünler başarıyla oluşturuldu, SQL ile toplu brand linking başlatılıyor...")
    const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await pgConnection.raw(PRODUCT_BRAND_LINK_QUERY)
    logger.info("SQL ile toplu brand linking işlemi tamamlandı.")

    // Inventory levels oluştur (toplu ve tek seferde, 30K ürün için optimize)
    const { data: allInventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id"],
    })
    const stockLocations = await container.resolve(Modules.STOCK_LOCATION).listStockLocations({})
    if (stockLocations.length > 0) {
      const stockLocation = stockLocations[0]
      const inventoryModuleService = container.resolve(Modules.INVENTORY)
      const existingLevels = await inventoryModuleService.listInventoryLevels({
        location_id: stockLocation.id,
      })
      const existingItemIds = new Set(existingLevels.map((level: any) => level.inventory_item_id))

      const newInventoryLevels = allInventoryItems
        .filter((item: any) => !existingItemIds.has(item.id))
        .map((item: any) => ({
          location_id: stockLocation.id,
          stocked_quantity: 1000000,
          inventory_item_id: item.id,
        }))

      const INV_LEVEL_BATCH_SIZE = 1000
      for (let i = 0; i < newInventoryLevels.length; i += INV_LEVEL_BATCH_SIZE) {
        const thisBatch = newInventoryLevels.slice(i, i + INV_LEVEL_BATCH_SIZE)
        await createInventoryLevelsWorkflow(container).run({
          input: {
            inventory_levels: thisBatch,
          },
        })
      }
    }

    res.json({
      success: true,
      message: `${createdProducts} ürün oluşturuldu, brand linking SQL ile gerçekleştirildi`,
      count: createdProducts,
      brand_links_sql: true,
      expected_brand_links: totalProductsWithBrandId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/seed/products
 * Tüm ürünleri siler (artık paralel değil)
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const productService = container.resolve(Modules.PRODUCT)

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title"],
    })

    if (!products || products.length === 0) {
      return res.json({
        success: true,
        message: "Silinecek ürün bulunamadı",
        deleted_count: 0,
      })
    }

    let deletedCount = 0
    const errors: string[] = []
    const BATCH_SIZE = 250

    let productBatches: any[][] = []
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      productBatches.push(products.slice(i, i + BATCH_SIZE))
    }
    const deleteBatch = async (batch: any[]) => {
      try {
        const ids = batch.map(p => p.id)
        await productService.deleteProducts(ids)
        return ids.length
      } catch (error: any) {
        for (const product of batch) {
          errors.push(`Ürün ${product.title} (${product.id}) silinirken hata: ${error.message}`)
          logger.warn(`Failed to delete product ${product.title}: ${error.message}`)
        }
        return 0
      }
    }
    for (let i = 0; i < productBatches.length; i++) {
      const completedCount = await deleteBatch(productBatches[i])
      deletedCount += completedCount
    }

    res.json({
      success: errors.length === 0,
      message: `${deletedCount} ürün silindi`,
      deleted_count: deletedCount,
      total_count: products.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}
