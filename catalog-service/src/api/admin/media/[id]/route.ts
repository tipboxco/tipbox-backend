import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MinioStorageService } from "../../../../plugins/minio-storage/service"

// MinIO service instance - singleton pattern
let minioService: MinioStorageService | null = null

function getMinioService(): MinioStorageService {
  if (!minioService) {
    minioService = new MinioStorageService({
      endpoint: process.env.MINIO_ENDPOINT || "localhost:9000",
      bucket: process.env.MINIO_BUCKET || "medusa",
      accessKeyId: process.env.MINIO_ACCESS_KEY || "",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "",
      useSSL: process.env.MINIO_USE_SSL === "true",
      region: process.env.MINIO_REGION,
    })
  }
  return minioService
}

// DELETE /admin/media/:id - Delete a media file
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    // id is the key in MinIO (e.g., "media/uuid.jpg")
    const key = decodeURIComponent(id)

    // Security: Prevent directory traversal
    if (!key.startsWith("media/")) {
      return res.status(400).json({
        error: "Geçersiz dosya yolu",
      })
    }

    const minioService = getMinioService()
    await minioService.deleteFile(key)

    res.json({
      id: key,
      deleted: true,
    })
  } catch (error: any) {
    console.error("Dosya silme hatası:", error)
    res.status(500).json({
      error: error.message || "Dosya silinirken hata oluştu",
    })
  }
}

