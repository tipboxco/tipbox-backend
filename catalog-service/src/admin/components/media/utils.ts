import { ImageValidationResult } from "./types"

/**
 * Validate image file
 */
export function validateImageFile(
  file: File | null,
  maxSizeMB: number = 5
): ImageValidationResult {
  if (!file) {
    return { valid: false, error: "Dosya seçilmedi" }
  }

  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Lütfen geçerli bir resim dosyası seçin" }
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Resim boyutu ${maxSizeMB}MB'dan küçük olmalıdır`,
    }
  }

  return { valid: true }
}

/**
 * Convert file to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      resolve(result)
    }
    reader.onerror = () => {
      reject(new Error("Dosya okunamadı"))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Check if a string is a base64 data URL
 */
export function isBase64DataUrl(str: string | null): boolean {
  return str !== null && str.startsWith("data:")
}

