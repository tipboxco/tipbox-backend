import { useState, useCallback } from "react"
import { toast } from "@medusajs/ui"
import { validateImageFile, fileToBase64 } from "../utils"
import { compressImage, needsCompression } from "../utils/image-compression"

type UseImageUploadOptions = {
  maxSizeMB?: number
  onImageChange?: (imageUrl: string | string[] | null) => void
  multiple?: boolean
}

/**
 * Hook for handling image upload to MinIO and preview
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { maxSizeMB = 5, onImageChange, multiple = false } = options
  const [image, setImage] = useState<string | string[] | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = useCallback(
    async (file: File | null) => {
      if (!file) return

      // Validate file
      const validation = validateImageFile(file, maxSizeMB)
      if (!validation.valid) {
        toast.error("Hata", { description: validation.error })
        return
      }

      setIsUploading(true)
      try {
        // Convert to base64 for upload (compress if needed)
        // Compression threshold lowered to 50KB to reduce payload size
        // This helps avoid "request entity too large" errors
        let base64: string
        if (needsCompression(file, 50)) {
          // More aggressive compression for larger files
          // Quality reduced to 0.7 and max dimensions to 1200px
          base64 = await compressImage(file, 1200, 1200, 0.7)
        } else if (file.size > 30 * 1024) {
          // Light compression for medium files (30-50KB)
          base64 = await compressImage(file, 1600, 1600, 0.85)
        } else {
          base64 = await fileToBase64(file)
        }

        // Upload to MinIO via API
        const response = await fetch("/admin/media", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            filename: file.name,
            mimeType: file.type,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Resim yüklenemedi")
        }

        const data = await response.json()
        const imageUrl = data.file?.url || null

        if (imageUrl) {
          setImage(imageUrl)
          onImageChange?.(imageUrl)
          toast.success("Başarılı", { description: "Resim yüklendi" })
        } else {
          throw new Error("Resim URL'i alınamadı")
        }
      } catch (error: any) {
        console.error("Image upload error:", error)
        toast.error("Hata", { description: error.message || "Dosya yüklenemedi" })
      } finally {
        setIsUploading(false)
      }
    },
    [maxSizeMB, onImageChange]
  )

  const handleMultipleFileSelect = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      setIsUploading(true)
      const uploadedUrls: string[] = []
      const errors: string[] = []

      try {
        for (const file of files) {
          // Validate file
          const validation = validateImageFile(file, maxSizeMB)
          if (!validation.valid) {
            errors.push(`${file.name}: ${validation.error}`)
            continue
          }

          try {
            // Convert to base64 for upload (compress if needed)
            let base64: string
            if (needsCompression(file, 50)) {
              base64 = await compressImage(file, 1200, 1200, 0.7)
            } else if (file.size > 30 * 1024) {
              base64 = await compressImage(file, 1600, 1600, 0.85)
            } else {
              base64 = await fileToBase64(file)
            }

            // Upload to MinIO via API
            const response = await fetch("/admin/media", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file: base64,
                filename: file.name,
                mimeType: file.type,
              }),
            })

            if (!response.ok) {
              const error = await response.json()
              errors.push(`${file.name}: ${error.error || "Yüklenemedi"}`)
              continue
            }

            const data = await response.json()
            const imageUrl = data.file?.url || null

            if (imageUrl) {
              uploadedUrls.push(imageUrl)
            }
          } catch (error: any) {
            console.error(`Image upload error for ${file.name}:`, error)
            errors.push(`${file.name}: ${error.message || "Yüklenemedi"}`)
          }
        }

        if (uploadedUrls.length > 0) {
          setImage(uploadedUrls)
          onImageChange?.(uploadedUrls)
          toast.success("Başarılı", {
            description: `${uploadedUrls.length} resim yüklendi${errors.length > 0 ? `, ${errors.length} başarısız` : ""}`,
          })
        }

        if (errors.length > 0 && uploadedUrls.length === 0) {
          toast.error("Hata", {
            description: errors.slice(0, 3).join(", ") + (errors.length > 3 ? "..." : ""),
          })
        }
      } catch (error: any) {
        console.error("Multiple image upload error:", error)
        toast.error("Hata", { description: error.message || "Dosyalar yüklenemedi" })
      } finally {
        setIsUploading(false)
      }
    },
    [maxSizeMB, onImageChange]
  )

  const setImageValue = useCallback(
    (value: string | string[] | null) => {
      setImage(value)
      onImageChange?.(value)
    },
    [onImageChange]
  )

  const clearImage = useCallback(() => {
    setImage(null)
    onImageChange?.(null)
  }, [onImageChange])

  return {
    image,
    isUploading,
    handleFileSelect,
    handleMultipleFileSelect,
    setImageValue,
    clearImage,
  }
}

