import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"
import AdmZip from "adm-zip"

/**
 * Zip dosyasından CSV dosyalarını extract eder
 */
function extractCsvFromZip(csvDataPath: string): void {
  const zipPath = path.join(csvDataPath, "products_with_images.zip")
  
  if (!fs.existsSync(zipPath)) {
    throw new Error("Zip dosyası bulunamadı: products_with_images.zip")
  }

  try {
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    
    // CSV dosyalarını extract et
    zipEntries.forEach((entry) => {
      if (entry.entryName.endsWith(".csv")) {
        const fileName = path.basename(entry.entryName)
        const outputPath = path.join(csvDataPath, fileName)
        
        // Dosya zaten varsa atla
        if (!fs.existsSync(outputPath)) {
          const content = zip.readFile(entry)
          if (content) {
            fs.writeFileSync(outputPath, content)
            console.log(`CSV dosyası extract edildi: ${fileName}`)
          }
        }
      }
    })
  } catch (error) {
    console.error("Zip extract hatası:", error)
    throw error
  }
}

/**
 * GET /admin/seed
 * Seed dataların bilgilerini döndürür
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")
    
    // CSV dosyalarının varlığını kontrol et
    const categoriesCsvPath = path.join(csvDataPath, "categories.csv")
    const brandsCsvPath = path.join(csvDataPath, "brands.csv")
    const productsCsvPath = path.join(csvDataPath, "products_with_images.csv")
    
    const categoriesExists = fs.existsSync(categoriesCsvPath)
    const brandsExists = fs.existsSync(brandsCsvPath)
    const productsExists = fs.existsSync(productsCsvPath)
    
    // Eğer CSV dosyaları yoksa, zip'ten extract et
    if (!categoriesExists || !brandsExists || !productsExists) {
      try {
        extractCsvFromZip(csvDataPath)
      } catch (error) {
        console.error("Zip'ten CSV extract edilemedi:", error)
        // Hata olsa bile devam et, belki bazı CSV'ler zaten var
      }
    }
    
    // CSV dosyalarını oku ve sayıları hesapla
    let categoriesCount = 0
    let brandsCount = 0
    let productsCount = 0
    
    try {
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
          file_exists: fs.existsSync(path.join(csvDataPath, "brands.csv")),
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

