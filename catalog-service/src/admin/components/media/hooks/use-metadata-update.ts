import { useState, useCallback } from "react"
import { toast } from "@medusajs/ui"

type UseMetadataUpdateOptions = {
  entityId: string
  updateEndpoint: string
  successMessage?: string
  errorMessagePrefix?: string
}

/**
 * Hook for updating entity metadata
 */
export function useMetadataUpdate(options: UseMetadataUpdateOptions) {
  const {
    entityId,
    updateEndpoint,
    successMessage = "Medya bilgileri güncellendi",
    errorMessagePrefix = "Güncelleme",
  } = options

  const [isSaving, setIsSaving] = useState(false)

  const updateMetadata = useCallback(
    async (metadata: Record<string, any>) => {
      setIsSaving(true)
      try {
        // Replace :id placeholder with actual entity ID
        const endpoint = updateEndpoint.replace(":id", entityId)

        const response = await fetch(endpoint, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || `${errorMessagePrefix} sırasında hata oluştu`)
        }

        toast.success("Başarılı", { description: successMessage })
        return true
      } catch (error: any) {
        toast.error("Hata", {
          description: error.message || `${errorMessagePrefix} sırasında hata oluştu`,
        })
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [entityId, updateEndpoint, successMessage, errorMessagePrefix]
  )

  return {
    isSaving,
    updateMetadata,
  }
}

