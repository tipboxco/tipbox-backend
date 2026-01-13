/**
 * Compress image to reduce file size
 * Returns compressed image as base64 data URL
 */
export function compressImage(
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        // Create canvas and compress
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed"))
              return
            }

            // Convert blob to base64
            const reader = new FileReader()
            reader.onload = () => {
              resolve(reader.result as string)
            }
            reader.onerror = () => {
              reject(new Error("Failed to read compressed image"))
            }
            reader.readAsDataURL(blob)
          },
          file.type || "image/jpeg",
          quality
        )
      }
      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }
      img.src = e.target?.result as string
    }
    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Check if image needs compression
 * Returns true if file size is larger than threshold
 */
export function needsCompression(file: File, thresholdKB: number = 100): boolean {
  return file.size > thresholdKB * 1024
}

