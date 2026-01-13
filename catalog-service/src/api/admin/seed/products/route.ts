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
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
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

      let brand_id: string | undefined
      // Ürün-Brand eşlemesi: Eğer productRow.brand_id varsa, brandMap'ten asıl brand.id'sini bul ve ata
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

      // Prepare options as expected by Medusa: array of option objects
      // The variant's options must provide values matching these option titles
      // We'll use "Size" as a default for every product, value: "Default"
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

      // brand_id'yi productObj'ye ekleme - linkleme yöntemiyle sonra bağlanacak
      return { productObj, brand_id }
    }

    let failedBatches = 0
    let linkedBrands = 0
    let failedBrandLinks = 0
    
    // Mevcut brand linkini kontrol et ve silme fonksiyonu
    const removeExistingBrandLink = async (productId: string): Promise<boolean> => {
      try {
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
        
        // Mevcut linki sil
        await remoteLink.dismiss({
          [Modules.PRODUCT]: {
            product_id: productId,
          },
          brand: {
            brand_id: currentBrand.id,
          },
        })
        
        // Link'in gerçekten silindiğini doğrula (max 3 deneme, her biri 100ms bekleme)
        for (let retry = 0; retry < 3; retry++) {
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
        
        return false // Link silinemedi
      } catch (error: any) {
        logger.warn(`[Brand Link Silme Hatası] Ürün ${productId}: ${error.message}`)
        return false
      }
    }
    
    // Paralel işlem sayısını sınırlandırmak için helper fonksiyon
    const processInBatches = async <T, R>(
      items: T[],
      batchSize: number,
      processor: (item: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = []
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(processor))
        results.push(...batchResults)
        // Her batch arasında kısa bir bekleme (DB yükünü azaltmak için)
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      return results
    }
    
    // Brand link oluşturma fonksiyonu (basitleştirilmiş ve daha güvenilir)
    const createBrandLink = async (productId: string, brandId: string): Promise<boolean> => {
      // Önce mevcut linki kontrol et
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "brand.id"],
        filters: {
          id: productId,
        },
      })
      
      const currentBrand = products[0]?.brand
      
      // Eğer aynı brand'e zaten linklenmişse, işlemi atla
      if (currentBrand?.id === brandId) {
        return true // Zaten doğru brand'e linklenmiş
      }
      
      // Eğer farklı bir brand'e linklenmişse, önce onu sil
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
          // Link silme işleminin tamamlanması için bekle
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (dismissError: any) {
          logger.warn(
            `[Brand Link Uyarısı] Ürün ${productId} için mevcut brand linki silinirken hata: ${dismissError.message}`
          )
          // Devam et, yeni link oluşturmayı dene
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
        return true
      } catch (error: any) {
        // Eğer "multiple links" hatası alırsak, bir kez daha dene
        if (error.message?.includes("multiple links") || error.message?.includes("Cannot create")) {
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Tekrar kontrol et
          const { data: recheckProducts } = await query.graph({
            entity: "product",
            fields: ["id", "brand.id"],
            filters: {
              id: productId,
            },
          })
          
          const recheckBrand = recheckProducts[0]?.brand
          
          // Eğer aynı brand'e zaten linklenmişse, başarılı say
          if (recheckBrand?.id === brandId) {
            return true
          }
          
          // Tekrar dene
          try {
            await remoteLink.create({
              [Modules.PRODUCT]: {
                product_id: productId,
              },
              brand: {
                brand_id: brandId,
              },
            })
            return true
          } catch (retryError: any) {
            logger.warn(
              `[Brand Link Hatası] Ürün ${productId} -> Brand ${brandId} linklenirken hata (retry): ${retryError.message}`
            )
            return false
          }
        } else {
          logger.warn(
            `[Brand Link Hatası] Ürün ${productId} -> Brand ${brandId} linklenirken hata: ${error.message}`
          )
          return false
        }
      }
    }
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const productsToCreate: any[] = []
      const failedProducts: string[] = []
      // Handle bazlı eşleştirme için: handle => brand_id mapping
      const batchBrandLinks = new Map<string, string>()

      for (const productRow of batch) {
        try {
          const { productObj, brand_id } = prepareProduct(productRow)
          if (productObj.handle && !/^[a-z0-9-]+$/.test(productObj.handle)) {
            logger.warn(
              `[Ürün Hazırlama Hatası] Handle URL-safe değil: "${productObj.handle}" (Ürün: ${productRow.title || productRow.id})`
            )
          }
          productsToCreate.push(productObj)
          // Brand linki için handle bazlı sakla (daha güvenilir)
          if (brand_id && productObj.handle) {
            batchBrandLinks.set(productObj.handle, brand_id)
          }
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
          
          // Oluşturulan ürünler için brand linklerini hemen oluştur (handle bazlı eşleştirme)
          const batchBrandLinksToCreate: Array<[string, string]> = []
          let brandIdNotFoundCount = 0
          let handleNotFoundCount = 0
          
          for (const createdProduct of createdProductsResult) {
            if (!createdProduct.handle) {
              handleNotFoundCount++
              continue
            }
            
            const brandId = batchBrandLinks.get(createdProduct.handle)
            if (brandId) {
              batchBrandLinksToCreate.push([createdProduct.id, brandId])
            } else {
              brandIdNotFoundCount++
            }
          }
          
          // Detaylı loglama
          if (createdProductsResult.length !== productsToCreate.length) {
            logger.warn(
              `[Brand Link Uyarısı] Batch ${i + 1}: ${productsToCreate.length} ürün gönderildi, ` +
              `${createdProductsResult.length} ürün oluşturuldu. Bazı brand linkleri atlanmış olabilir.`
            )
          }
          
          if (brandIdNotFoundCount > 0) {
            logger.info(
              `[Brand Link Bilgisi] Batch ${i + 1}: ${brandIdNotFoundCount} ürün için brand_id bulunamadı (CSV'de brand_id yok veya brandMap'te eşleşme yok)`
            )
          }
          
          if (handleNotFoundCount > 0) {
            logger.warn(
              `[Brand Link Uyarısı] Batch ${i + 1}: ${handleNotFoundCount} ürün için handle bulunamadı`
            )
          }
          
          // Bu batch için brand linklerini oluştur (sınırlı paralel işlem)
          if (batchBrandLinksToCreate.length > 0) {
            // Paralel işlem sayısını sınırla (10 link aynı anda)
            const CONCURRENT_LINKS = 10
            const results = await processInBatches(
              batchBrandLinksToCreate,
              CONCURRENT_LINKS,
              async ([productId, brandId]) => createBrandLink(productId, brandId)
            )
            const successCount = results.filter(r => r === true).length
            linkedBrands += successCount
            failedBrandLinks += (results.length - successCount)
            
            logger.info(
              `Batch ${i + 1}/${batches.length}: ${successCount}/${batchBrandLinksToCreate.length} brand linki oluşturuldu ` +
              `(${createdProductsResult.length} ürün oluşturuldu, ${brandIdNotFoundCount} ürün için brand_id yok)`
            )
            
            if (successCount < batchBrandLinksToCreate.length) {
              logger.warn(
                `[Brand Link Uyarısı] Batch ${i + 1}: ${batchBrandLinksToCreate.length - successCount} link oluşturulamadı`
              )
            }
          } else {
            logger.info(
              `Batch ${i + 1}/${batches.length}: ${createdProductsResult.length} ürün oluşturuldu, ancak hiçbir ürün için brand linki oluşturulamadı ` +
              `(${brandIdNotFoundCount} ürün için brand_id yok)`
            )
          }
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
          `İlerleme: ${createdProducts} / ${productsData.length} ürün oluşturuldu, ` +
          `${linkedBrands} brand linki oluşturuldu. ${failedBatches} batch başarısız oldu.`
        )
      }
    }
    
    logger.info(
      `Brand linkleme tamamlandı: ${linkedBrands} başarılı, ${failedBrandLinks} başarısız ` +
      `(CSV'de ${totalProductsWithBrandId} ürün için brand_id vardı, ${createdProducts} ürün oluşturuldu)`
    )

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
      message: `${createdProducts} ürün oluşturuldu, ${linkedBrands} ürün brand'e bağlandı`,
      count: createdProducts,
      brand_links: linkedBrands,
      failed_brand_links: failedBrandLinks,
      expected_brand_links: totalProductsWithBrandId,
      brand_link_success_rate: totalProductsWithBrandId > 0 
        ? `${((linkedBrands / totalProductsWithBrandId) * 100).toFixed(2)}%` 
        : "N/A",
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
