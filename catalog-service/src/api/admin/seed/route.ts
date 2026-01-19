import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

/**
 * GET /admin/seed
 * Seed dataların bilgilerini döndürür
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")
    
    // CSV dosyalarını oku ve sayıları hesapla
    let categoriesCount = 0
    let brandsCount = 0
    let productsCount = 0
    
    try {
      const categoriesCsvPath = path.join(csvDataPath, "categories.csv")
      if (fs.existsSync(categoriesCsvPath)) {
        const categoriesCsvContent = fs.readFileSync(categoriesCsvPath, "utf-8")
        const categoriesData = Papa.parse(categoriesCsvContent, {
          header: true,
          skipEmptyLines: true,
        }).data as any[]
        categoriesCount = categoriesData?.length
      }
    } catch (error) {
      console.error("Categories CSV okuma hatası:", error)
    }
    
    try {
      const brandsCsvPath = path.join(csvDataPath, "brands_2.csv")
      if (fs.existsSync(brandsCsvPath)) {
        const brandsCsvContent = fs.readFileSync(brandsCsvPath, "utf-8")
        const brandsData = Papa.parse(brandsCsvContent, {
          header: true,
          skipEmptyLines: true,
        }).data as any[]
        brandsCount = brandsData?.length
      }
    } catch (error) {
      console.error("Brands CSV okuma hatası:", error)
    }
    
    try {
      const productsCsvPath = path.join(csvDataPath, "products_with_images.csv")
      if (fs.existsSync(productsCsvPath)) {
        const productsCsvContent = fs.readFileSync(productsCsvPath, "utf-8")
        const productsData = Papa.parse(productsCsvContent, {
          header: true,
          skipEmptyLines: true,
        }).data as any[]
        productsCount = productsData.length
      }
    } catch (error) {
      console.error("Products CSV okuma hatası:", error)
    }
    
    res.json({
      seed_data: {
        categories: {
          count: categoriesCount,
          file_exists: fs.existsSync(path.join(csvDataPath, "categories.csv")),
        },
        brands: {
          count: brandsCount,
          file_exists: fs.existsSync(path.join(csvDataPath, "brands_2.csv")),
        },
        products: {
          count: productsCount,
          file_exists: fs.existsSync(path.join(csvDataPath, "products_with_images.csv")),
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

