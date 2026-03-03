import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

/**
 * POST /admin/seed/categories
 * Categories seed işlemini başlatır
 * 
 * Not: CSV'deki kategori id'si birebir db'ye aktarılır (manuel id).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")
    
    // Categories CSV'yi oku
    const categoriesCsvPath = path.join(csvDataPath, "categories.csv")
    if (!fs.existsSync(categoriesCsvPath)) {
      return res.status(404).json({ error: "Categories CSV dosyası bulunamadı" })
    }
    
    const categoriesCsvContent = fs.readFileSync(categoriesCsvPath, "utf-8")
    const categoriesData = Papa.parse(categoriesCsvContent, {
      header: true,
      skipEmptyLines: true,
    }).data as any[]

    // Category'leri parent-child ilişkisine göre sırala
    const sortedCategories = sortCategoriesByParentChild(categoriesData)
    const categoryMap = new Map<string, string>()
    
    let createdCount = 0
    let retryCount = 0
    const maxRetries = 3

    while (createdCount < sortedCategories.length && retryCount < maxRetries) {
      const remainingCategories = sortedCategories.filter(cat => !categoryMap.has(cat.id))
      
      if (remainingCategories.length === 0) break
      
      let progressInThisRound = 0
      
      for (const catRow of remainingCategories) {
        try {
          const parentCategoryId = catRow.parent_category_id && 
            catRow.parent_category_id !== "NULL" && 
            catRow.parent_category_id !== "" 
            ? categoryMap.get(catRow.parent_category_id) 
            : undefined
          
          if (catRow.parent_category_id && 
              catRow.parent_category_id !== "NULL" && 
              catRow.parent_category_id !== "" &&
              !parentCategoryId) {
            continue
          }
          
          const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
            input: {
              product_categories: [{
                name: catRow.name,
                description: catRow.description || "",
                handle: catRow.handle,
                is_active: catRow.is_active === "True" || catRow.is_active === true,
                is_internal: catRow.is_internal === "True" || catRow.is_internal === true,
                rank: parseInt(catRow.rank) || 0,
                parent_category_id: parentCategoryId || undefined,
                metadata: {
                  categoryid: catRow.id,
                },
              }],
            },
          })
          
          if (categoryResult && categoryResult.length > 0) {
            categoryMap.set(catRow.id, categoryResult[0].id)
            createdCount++
            progressInThisRound++
          }
        } catch (error: any) {
          logger.warn(`Failed to create category ${catRow.name}: ${error.message}`)
        }
      }
      
      if (progressInThisRound === 0) {
        retryCount++
        logger.warn(`No progress in category creation. Retry ${retryCount}/${maxRetries}`)
      } else {
        retryCount = 0
        logger.info(`Created ${createdCount}/${sortedCategories.length} categories...`)
      }
    }
    
    res.json({
      success: true,
      message: `${createdCount} kategori oluşturuldu`,
      count: createdCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

/**
 * DELETE /admin/seed/categories
 * Tüm kategorileri siler
 *
 * Strateji: Iteratif leaf-first silme.
 * Her turda child'i olmayan kategorileri (leaf) bulup siler,
 * bu sayede parent'lar bir sonraki turda leaf olur.
 * parent_category_id alanina bagimsiz calisir (category_children relation kullanir).
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const productService = container.resolve(Modules.PRODUCT)

    // Ilk sayimi al
    const { data: allCategories } = await query.graph({
      entity: "product_category",
      fields: ["id"],
    })

    if (!allCategories || allCategories.length === 0) {
      return res.json({
        success: true,
        message: "Silinecek kategori bulunamadı",
        deleted_count: 0,
      })
    }

    const totalCount = allCategories.length
    logger.info(`[Seed DELETE] ${totalCount} kategori silinecek...`)

    let deletedCount = 0
    let round = 0
    const MAX_ROUNDS = 20 // sonsuz donguye karsi koruma

    while (round < MAX_ROUNDS) {
      round++

      // Her turda tum kategorileri children bilgisiyle cek
      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "category_children.id"],
      })

      if (!categories || categories.length === 0) break

      // Leaf kategorileri bul (child'i olmayanlar)
      const leafIds = categories
        .filter((cat) => {
          const children = (cat as Record<string, unknown>).category_children as
            | { id: string }[]
            | undefined
          return !children || children.length === 0
        })
        .map((cat) => cat.id)

      if (leafIds.length === 0) {
        logger.warn(
          `[Seed DELETE] Tur ${round}: Leaf kategori bulunamadi, ${categories.length} kategori kaldi (circular reference olabilir)`,
        )
        // Circular reference durumunda tek tek silmeyi dene
        for (const cat of categories) {
          try {
            await productService.deleteProductCategories([cat.id])
            deletedCount++
          } catch {
            // skip
          }
        }
        break
      }

      // Leaf'leri batch halinde sil
      const BATCH_SIZE = 50
      for (let i = 0; i < leafIds.length; i += BATCH_SIZE) {
        const batch = leafIds.slice(i, i + BATCH_SIZE)
        try {
          await productService.deleteProductCategories(batch)
          deletedCount += batch.length
        } catch {
          // Batch basarisiz olursa tek tek sil
          for (const id of batch) {
            try {
              await productService.deleteProductCategories([id])
              deletedCount++
            } catch {
              // skip
            }
          }
        }
      }

      logger.info(
        `[Seed DELETE] Tur ${round}: ${leafIds.length} leaf silindi, toplam ${deletedCount}/${totalCount}`,
      )
    }

    logger.info(`[Seed DELETE] Tamamlandı: ${deletedCount}/${totalCount} kategori silindi`)

    res.json({
      success: deletedCount === totalCount,
      message: `${deletedCount} kategori silindi`,
      deleted_count: deletedCount,
      total_count: totalCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

function sortCategoriesByParentChild(categoriesData: any[]): any[] {
  const categoryMap = new Map<string, any>()
  const rootCategories: any[] = []
  const childCategories: any[] = []
  
  for (const cat of categoriesData) {
    categoryMap.set(cat.id, cat)
  }
  
  for (const cat of categoriesData) {
    const hasParent = cat.parent_category_id && 
      cat.parent_category_id !== "NULL" && 
      cat.parent_category_id !== "" &&
      categoryMap.has(cat.parent_category_id)
    
    if (hasParent) {
      childCategories.push(cat)
    } else {
      rootCategories.push(cat)
    }
  }
  
  const sorted: any[] = [...rootCategories]
  
  const sortedChildren = [...childCategories].sort((a, b) => {
    const aLevel = a.mpath ? a.mpath.split(".").length : 0
    const bLevel = b.mpath ? b.mpath.split(".").length : 0
    return aLevel - bLevel
  })
  
  sorted.push(...sortedChildren)
  
  return sorted
}
