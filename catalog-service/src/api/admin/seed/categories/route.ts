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
 * Optimize: Tek seferde tüm kategoriler yüklenir, topological sort (leaf-first) yapılır,
 * batch halinde silinir. Eski yöntem: her iterasyonda TÜM kategoriler yeniden yükleniyordu.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const productService = container.resolve(Modules.PRODUCT)

    // 1. Tek seferde tüm kategorileri yükle (sadece id + parent_category_id)
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "parent_category_id"],
    })

    if (!categories || categories.length === 0) {
      return res.json({
        success: true,
        message: "Silinecek kategori bulunamadı",
        deleted_count: 0,
      })
    }

    logger.info(`[Seed DELETE] ${categories.length} kategori silinecek...`)

    // 2. Topological sort: leaf-first (en derin child'lar önce, parent'lar sona)
    const childrenMap = new Map<string, string[]>()
    const categoryIds = new Set<string>()

    for (const cat of categories) {
      categoryIds.add(cat.id)
      if (cat.parent_category_id) {
        const children = childrenMap.get(cat.parent_category_id)
        if (children) {
          children.push(cat.id)
        } else {
          childrenMap.set(cat.parent_category_id, [cat.id])
        }
      }
    }

    // Kahn's algorithm — leaf-first (reverse topological order)
    const inDegree = new Map<string, number>()
    for (const id of categoryIds) {
      inDegree.set(id, 0)
    }
    for (const [, children] of childrenMap) {
      for (const childId of children) {
        if (categoryIds.has(childId)) {
          inDegree.set(childId, (inDegree.get(childId) ?? 0) + 1)
        }
      }
    }

    // Parent'lar üzerinden child'lara baktığımızda, "in-degree" burada
    // parent → children yönünde. Leaf node'lar = child'ı olmayanlar.
    // Leaf-first silme için: child'ı olmayanlardan başla, onları sildikçe parent'ları da leaf olur.
    const leafDegree = new Map<string, number>()
    for (const id of categoryIds) {
      leafDegree.set(id, (childrenMap.get(id) ?? []).filter(c => categoryIds.has(c)).length)
    }

    const queue: string[] = []
    for (const [id, degree] of leafDegree) {
      if (degree === 0) queue.push(id)
    }

    const sortedIds: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      sortedIds.push(id)

      // Bu node'un parent'ının child sayısını azalt
      const cat = categories.find(c => c.id === id)
      if (cat?.parent_category_id && categoryIds.has(cat.parent_category_id)) {
        const parentDegree = (leafDegree.get(cat.parent_category_id) ?? 1) - 1
        leafDegree.set(cat.parent_category_id, parentDegree)
        if (parentDegree === 0) {
          queue.push(cat.parent_category_id)
        }
      }
    }

    // Circular reference varsa, kalan ID'leri de ekle
    if (sortedIds.length < categories.length) {
      const sortedSet = new Set(sortedIds)
      for (const id of categoryIds) {
        if (!sortedSet.has(id)) sortedIds.push(id)
      }
      logger.warn(`[Seed DELETE] ${categories.length - sortedIds.length + (categories.length - new Set(sortedIds).size)} kategori circular reference nedeniyle zorla eklendi`)
    }

    // 3. Batch halinde sil (leaf-first sırayla, 50'lik batch)
    const DELETE_BATCH_SIZE = 50
    let deletedCount = 0
    let failedBatches = 0

    for (let i = 0; i < sortedIds.length; i += DELETE_BATCH_SIZE) {
      const batchIds = sortedIds.slice(i, i + DELETE_BATCH_SIZE)
      try {
        await productService.deleteProductCategories(batchIds)
        deletedCount += batchIds.length
      } catch (err: unknown) {
        failedBatches++
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.warn(`[Seed DELETE] Kategori batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1} silinirken hata: ${errMsg}`)
      }

      if ((i / DELETE_BATCH_SIZE + 1) % 5 === 0) {
        logger.info(`[Seed DELETE] Kategori ilerleme: ${deletedCount}/${categories.length}`)
      }
    }

    logger.info(`[Seed DELETE] Tamamlandı: ${deletedCount}/${categories.length} kategori silindi`)

    res.json({
      success: failedBatches === 0,
      message: `${deletedCount} kategori silindi`,
      deleted_count: deletedCount,
      total_count: categories.length,
      failed_batches: failedBatches,
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
