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
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const container = req.scope
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const productService = container.resolve(Modules.PRODUCT)
    
    let deletedCount = 0
    const errors: string[] = []
    const maxIterations = 1000 // Sonsuz döngü koruması
    let iteration = 0
    
    // Iteratif silme: Her iterasyonda child'ı olmayan kategorileri sil
    while (iteration < maxIterations) {
      iteration++
      
      // Her iterasyonda tüm kategorileri yeniden getir (güncel durumu görmek için)
      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "name", "parent_category_id"],
      })
      
      if (!categories || categories.length === 0) {
        logger.info(`Tüm kategoriler silindi. Toplam iterasyon: ${iteration}`)
        break
      }
      
      // Parent-child ilişkisini kur
      const childrenMap = new Map<string, string[]>()
      const categoryMap = new Map<string, any>()
      
      for (const cat of categories) {
        categoryMap.set(cat.id, cat)
        if (cat.parent_category_id) {
          if (!childrenMap.has(cat.parent_category_id)) {
            childrenMap.set(cat.parent_category_id, [])
          }
          childrenMap.get(cat.parent_category_id)!.push(cat.id)
        }
      }
      
      // Child'ı olmayan kategorileri bul
      const categoriesWithoutChildren = categories.filter(cat => {
        const children = childrenMap.get(cat.id) || []
        return children.length === 0
      })
      
      if (categoriesWithoutChildren.length === 0) {
        // Child'ı olmayan kategori yok ama hala kategoriler var - muhtemelen circular reference
        logger.warn(`Child'ı olmayan kategori bulunamadı ama ${categories.length} kategori kaldı. Kalan kategorileri zorla siliniyor...`)
        // Kalan tüm kategorileri sil
        for (const category of categories) {
          try {
            await productService.deleteProductCategories([category.id])
            deletedCount++
            logger.info(`Kategori zorla silindi: ${category.name} (${category.id})`)
          } catch (error: any) {
            errors.push(`Kategori ${category.name} (${category.id}) silinirken hata: ${error.message}`)
            logger.warn(`Failed to delete category ${category.name}: ${error.message}`)
          }
        }
        break
      }
      
      // Child'ı olmayan kategorileri sil
      let deletedInThisIteration = 0
      for (const category of categoriesWithoutChildren) {
        try {
          await productService.deleteProductCategories([category.id])
          deletedCount++
          deletedInThisIteration++
          logger.info(`Kategori silindi: ${category.name} (${category.id})`)
        } catch (error: any) {
          errors.push(`Kategori ${category.name} (${category.id}) silinirken hata: ${error.message}`)
          logger.warn(`Failed to delete category ${category.name}: ${error.message}`)
        }
      }
      
      logger.info(`Iterasyon ${iteration}: ${deletedInThisIteration} kategori silindi. Kalan: ${categories.length - deletedInThisIteration}`)
      
      // Eğer bu iterasyonda hiçbir şey silinmediyse, döngüden çık
      if (deletedInThisIteration === 0) {
        logger.warn(`Iterasyon ${iteration}: Hiçbir kategori silinmedi. Döngü sonlandırılıyor.`)
        break
      }
    }
    
    if (iteration >= maxIterations) {
      logger.error(`Maksimum iterasyon sayısına ulaşıldı (${maxIterations}). Bazı kategoriler silinmemiş olabilir.`)
      errors.push(`Maksimum iterasyon sayısına ulaşıldı. Bazı kategoriler silinmemiş olabilir.`)
    }
    
    // Son durumu kontrol et
    const { data: remainingCategories } = await query.graph({
      entity: "product_category",
      fields: ["id", "name"],
    })
    
    const totalCount = deletedCount + (remainingCategories?.length || 0)
    
    res.json({
      success: errors.length === 0 && (!remainingCategories || remainingCategories.length === 0),
      message: `${deletedCount} kategori silindi${remainingCategories && remainingCategories.length > 0 ? `, ${remainingCategories.length} kategori kaldı` : ""}`,
      deleted_count: deletedCount,
      remaining_count: remainingCategories?.length || 0,
      total_count: totalCount,
      iterations: iteration,
      errors: errors.length > 0 ? errors : undefined,
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
