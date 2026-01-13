import * as Minio from "minio"
import { randomUUID } from "crypto"
import * as path from "path"

export interface MinioStorageOptions {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
  useSSL?: boolean
  port?: number
}

export class MinioStorageService {
  private client: Minio.Client
  private bucket: string
  private options: MinioStorageOptions
  private bucketEnsured: boolean = false

  constructor(options: MinioStorageOptions) {
    this.options = options
    this.bucket = options.bucket

    // Parse endpoint to extract host and port
    const endpointUrl = new URL(
      options.endpoint.startsWith("http")
        ? options.endpoint
        : `http://${options.endpoint}`
    )

    const port = options.port || parseInt(endpointUrl.port) || (options.useSSL ? 443 : 9000)
    const useSSL = options.useSSL !== undefined ? options.useSSL : endpointUrl.protocol === "https:"

    // Region must be a valid string or undefined, not null or empty string
    const region = options.region && typeof options.region === "string" && options.region.trim() !== ""
      ? options.region.trim()
      : undefined

    this.client = new Minio.Client({
      endPoint: endpointUrl.hostname,
      port: port,
      useSSL: useSSL,
      accessKey: options.accessKeyId,
      secretKey: options.secretAccessKey,
      region: region,
    })
  }

  /**
   * Ensure bucket exists, create if it doesn't
   * This is called lazily before each operation
   */
  private async ensureBucket(): Promise<void> {
    // Skip if already ensured in this session
    if (this.bucketEnsured) {
      return
    }

    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        // makeBucket requires region to be a string or undefined
        // Use the same region as client initialization
        const region = this.options.region && typeof this.options.region === "string" && this.options.region.trim() !== ""
          ? this.options.region.trim()
          : undefined
        
        await this.client.makeBucket(this.bucket, region)
        console.log(`✅ MinIO bucket "${this.bucket}" oluşturuldu${region ? ` (region: ${region})` : ""}`)
      } else {
        console.log(`✅ MinIO bucket "${this.bucket}" zaten mevcut`)
      }
      this.bucketEnsured = true
    } catch (error: any) {
      console.error("❌ MinIO bucket kontrolü hatası:", error)
      // Don't throw here, let the operation try and fail with a clearer error
      // But mark as attempted so we don't retry on every call
      this.bucketEnsured = true
      throw new Error(`MinIO bucket oluşturulamadı: ${error.message}`)
    }
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    contentType?: string
  ): Promise<{ url: string; key: string }> {
    try {
      // Ensure bucket exists before upload
      await this.ensureBucket()

      // Generate unique filename
      const ext = path.extname(filename) || ".jpg"
      const uniqueId = randomUUID()
      const key = `media/${uniqueId}${ext}`

      // Upload to MinIO
      await this.client.putObject(this.bucket, key, buffer, buffer.length, {
        "Content-Type": contentType || this.getContentType(ext),
      })

      // Generate public URL
      const url = await this.getFileUrl(key)

      return { url, key }
    } catch (error: any) {
      console.error("MinIO dosya yükleme hatası:", error)
      
      // If bucket doesn't exist error, try to create it and retry once
      if (error.message && error.message.includes("does not exist")) {
        console.log(`🔄 Bucket bulunamadı, tekrar oluşturuluyor...`)
        this.bucketEnsured = false
        try {
          await this.ensureBucket()
          // Retry upload
          const ext = path.extname(filename) || ".jpg"
          const uniqueId = randomUUID()
          const key = `media/${uniqueId}${ext}`
          await this.client.putObject(this.bucket, key, buffer, buffer.length, {
            "Content-Type": contentType || this.getContentType(ext),
          })
          const url = await this.getFileUrl(key)
          return { url, key }
        } catch (retryError: any) {
          throw new Error(`Dosya MinIO'ya yüklenemedi: ${retryError.message}`)
        }
      }
      
      throw new Error(`Dosya MinIO'ya yüklenemedi: ${error.message}`)
    }
  }

  /**
   * Get file URL from MinIO
   */
  async getFileUrl(key: string): Promise<string> {
    try {
      // Try to generate presigned URL (valid for 7 days)
      // This works even if bucket is not public
      const url = await this.client.presignedGetObject(this.bucket, key, 7 * 24 * 60 * 60)
      return url
    } catch (error: any) {
      console.error("MinIO presigned URL oluşturma hatası:", error)
      // Fallback: construct public URL manually
      // This assumes bucket is configured for public access
      return this.getPublicUrl(key)
    }
  }

  /**
   * Get public URL for a file (assumes bucket is public)
   */
  private getPublicUrl(key: string): string {
    const protocol = this.options.useSSL ? "https" : "http"
    const endpointUrl = new URL(
      this.options.endpoint.startsWith("http")
        ? this.options.endpoint
        : `${protocol}://${this.options.endpoint}`
    )
    const port = this.options.port || parseInt(endpointUrl.port) || (this.options.useSSL ? 443 : 9000)
    const portSuffix = (port === 443 && this.options.useSSL) || (port === 80 && !this.options.useSSL) ? "" : `:${port}`
    return `${protocol}://${endpointUrl.hostname}${portSuffix}/${this.bucket}/${key}`
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(key: string): Promise<void> {
    try {
      // Ensure bucket exists before delete
      await this.ensureBucket()
      
      await this.client.removeObject(this.bucket, key)
    } catch (error: any) {
      console.error("MinIO dosya silme hatası:", error)
      throw new Error(`Dosya MinIO'dan silinemedi: ${error.message}`)
    }
  }

  /**
   * List all files in the bucket
   */
  async listFiles(prefix: string = "media/"): Promise<Array<{ key: string; url: string; size: number; lastModified: Date }>> {
    try {
      // Ensure bucket exists before listing
      await this.ensureBucket()

      const objectsList: Array<{ key: string; url: string; size: number; lastModified: Date }> = []
      const objectsStream = this.client.listObjects(this.bucket, prefix, true)

      for await (const obj of objectsStream) {
        if (obj.name) {
          const url = await this.getFileUrl(obj.name)
          objectsList.push({
            key: obj.name,
            url,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date(),
          })
        }
      }

      return objectsList
    } catch (error: any) {
      console.error("MinIO dosya listeleme hatası:", error)
      throw new Error(`Dosyalar listelenemedi: ${error.message}`)
    }
  }

  /**
   * Get content type from file extension
   */
  private getContentType(ext: string): string {
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
    }
    return contentTypes[ext.toLowerCase()] || "application/octet-stream"
  }
}

