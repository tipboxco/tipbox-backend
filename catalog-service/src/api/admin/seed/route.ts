import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

const CHUNK_SIZE = 100

/**
 * CSV dosyasını streaming ile okur, belleğe tamamını yüklemeden
 * CHUNK_SIZE'lık parçalar halinde işler ve satır sayısını döndürür.
 */
function countCsvRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve(0)
      return
    }

    let count = 0
    const readStream = fs.createReadStream(filePath, { encoding: "utf-8" })

    Papa.parse(readStream, {
      header: true,
      skipEmptyLines: true,
      chunkSize: CHUNK_SIZE,
      chunk: (results: Papa.ParseResult<Record<string, unknown>>) => {
        count += results.data.length
      },
      complete: () => {
        resolve(count)
      },
      error: (error: Error) => {
        reject(error)
      },
    })
  })
}

/**
 * GET /admin/seed
 * Seed dataların bilgilerini döndürür
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const csvDataPath = path.join(process.cwd(), "src", "scripts", "tipbox-datas")

    const categoriesCsvPath = path.join(csvDataPath, "categories.csv")
    const brandsCsvPath = path.join(csvDataPath, "brands_2.csv")
    const productsCsvPath = path.join(csvDataPath, "products_with_images.csv")

    let categoriesCount = 0
    let brandsCount = 0
    let productsCount = 0

    try {
      categoriesCount = await countCsvRows(categoriesCsvPath)
    } catch (error) {
      console.error("Categories CSV okuma hatası:", error)
    }

    try {
      brandsCount = await countCsvRows(brandsCsvPath)
    } catch (error) {
      console.error("Brands CSV okuma hatası:", error)
    }

    try {
      productsCount = await countCsvRows(productsCsvPath)
    } catch (error) {
      console.error("Products CSV okuma hatası:", error)
    }

    res.json({
      seed_data: {
        categories: {
          count: categoriesCount,
          file_exists: fs.existsSync(categoriesCsvPath),
        },
        brands: {
          count: brandsCount,
          file_exists: fs.existsSync(brandsCsvPath),
        },
        products: {
          count: productsCount,
          file_exists: fs.existsSync(productsCsvPath),
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    res.status(500).json({ error: message })
  }
}

