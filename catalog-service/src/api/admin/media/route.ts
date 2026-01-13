import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import * as path from "path"
import { MinioStorageService } from "../../../plugins/minio-storage/service"

type MediaFile = {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
}

let minioService: MinioStorageService | null = null

function getMinioService(): MinioStorageService {
  if (!minioService) {
    const params = {
      endpoint: process.env.MINIO_ENDPOINT || "localhost:9000",
      bucket: process.env.MINIO_BUCKET || "medusa",
      accessKeyId: process.env.MINIO_ACCESS_KEY || "",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "",
      useSSL: process.env.MINIO_USE_SSL === "true",
      region: process.env.MINIO_REGION,
    }
    minioService = new MinioStorageService(params)
  }
  return minioService
}

// GET /admin/media
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const minioService = getMinioService()
    const files = await minioService.listFiles("media/")

    const mediaFiles: MediaFile[] = files
      .filter((file) => {
        const ext = path.extname(file.key).toLowerCase()
        return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)
      })
      .map((file) => {
        const filename = path.basename(file.key)
        return {
          id: file.key,
          filename,
          url: file.url,
          size: file.size,
          mimeType: getMimeType(filename),
          createdAt: file.lastModified.toISOString(),
        }
      })

    mediaFiles.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    res.json({
      files: mediaFiles,
      count: mediaFiles.length,
    })
  } catch (error: any) {
    console.error("Media listesi alınırken hata:", error)
    res.status(500).json({
      error: error.message || "Medya listesi alınırken hata oluştu",
    })
  }
}

// POST /admin/media
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    let buffer: Buffer
    let originalFilename: string
    let mimeType: string | undefined

    // 1) multipart/form-data (Multer ile)
    const file = (req as any).file as any | undefined

    if (file) {
      buffer = file.buffer
      originalFilename = file.originalname
      mimeType = file.mimetype
    } else {
      // 2) JSON (base64) fallback
      const { file: fileData, filename, mimeType: providedMimeType } =
        (req.body || {}) as {
          file?: string
          filename?: string
          mimeType?: string
        }

      if (!fileData) {
        return res.status(400).json({
          error: "Dosya bulunamadı",
        })
      }

      const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "")
      buffer = Buffer.from(base64Data, "base64")
      originalFilename = filename || "image.jpg"
      mimeType = providedMimeType
    }

    // Max 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: "Dosya boyutu 10MB'dan küçük olmalıdır",
      })
    }

    if (mimeType && !mimeType.startsWith("image/")) {
      return res.status(400).json({
        error: "Geçersiz dosya tipi. Sadece resim dosyaları kabul edilir.",
      })
    }

    const ext = originalFilename
      ? path.extname(originalFilename)
      : mimeType
      ? `.${mimeType.split("/")[1]}`
      : ".jpg"

    const filename = originalFilename || `image${ext}`

    const minioService = getMinioService()
    const { url, key } = await minioService.uploadFile(
      buffer,
      filename,
      mimeType
    )

    const mediaFile: MediaFile = {
      id: key,
      filename: path.basename(key),
      url,
      size: buffer.length,
      mimeType: mimeType || getMimeType(filename),
      createdAt: new Date().toISOString(),
    }

    res.json({
      file: mediaFile,
    })
  } catch (error: any) {
    console.error("Resim yükleme hatası:", error)
    res.status(500).json({
      error: error.message || "Resim yüklenirken hata oluştu",
    })
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  }
  return mimeTypes[ext] || "image/jpeg"
}