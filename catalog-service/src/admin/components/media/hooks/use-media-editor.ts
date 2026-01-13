import { useState, useCallback, useRef, useEffect } from "react"
import { MediaWidgetConfig } from "../types"
import { useImageUpload } from "./use-image-upload"
import { useMetadataUpdate } from "./use-metadata-update"

/**
 * Hook for managing media editor state and operations
 */
export function useMediaEditor(config: MediaWidgetConfig) {
  const { fields, metadata, updateEndpoint, entityId, successMessage, errorMessagePrefix } = config

  const [isEditing, setIsEditing] = useState(false)
  const [originalValues, setOriginalValues] = useState<Record<string, string | null>>({})

  // Create image upload hooks for each field
  const imageHooks = fields.reduce(
    (acc, field) => {
      acc[field.key] = useImageUpload({
        // Image change is handled by the hook itself
      })
      return acc
    },
    {} as Record<string, ReturnType<typeof useImageUpload>>
  )

  // Create input refs for each field
  const inputRefs = fields.reduce(
    (acc, field) => {
      acc[field.key] = useRef<HTMLInputElement>(null)
      return acc
    },
    {} as Record<string, React.RefObject<HTMLInputElement>>
  )

  // Metadata update hook
  const { isSaving, updateMetadata } = useMetadataUpdate({
    entityId,
    updateEndpoint,
    successMessage,
    errorMessagePrefix,
  })

  // Initialize values from metadata
  useEffect(() => {
    if (metadata) {
      const initialValues: Record<string, string | null> = {}
      fields.forEach((field) => {
        initialValues[field.key] = metadata[field.key] || null
        imageHooks[field.key].setImageValue(initialValues[field.key])
      })
      setOriginalValues(initialValues)
    }
  }, [metadata, fields])

  const startEditing = useCallback(() => {
    setIsEditing(true)
  }, [])

  const cancelEditing = useCallback(() => {
    // Reset to original values
    fields.forEach((field) => {
      imageHooks[field.key].setImageValue(originalValues[field.key] || null)
      if (inputRefs[field.key].current) {
        inputRefs[field.key].current!.value = ""
      }
    })
    setIsEditing(false)
  }, [fields, originalValues, imageHooks, inputRefs])

  const saveChanges = useCallback(async () => {
    // Collect all field values
    const updatedMetadata: Record<string, string | null> = {}

    for (const field of fields) {
      const hook = imageHooks[field.key]
      const inputRef = inputRefs[field.key]

      // If there's a new file, convert it to base64
      if (inputRef.current?.files?.[0]) {
        const file = inputRef.current.files[0]
        try {
          const { fileToBase64 } = await import("../utils")
          updatedMetadata[field.key] = await fileToBase64(file)
        } catch (error) {
          // Error already handled by fileToBase64
          return false
        }
      } else {
        // Use current image value (could be existing URL or new base64)
        updatedMetadata[field.key] = hook.image
      }
    }

    // Update metadata
    const success = await updateMetadata(updatedMetadata)

    if (success) {
      // Update original values
      setOriginalValues(updatedMetadata)
      setIsEditing(false)

      // Clear input refs
      fields.forEach((field) => {
        if (inputRefs[field.key].current) {
          inputRefs[field.key].current!.value = ""
        }
      })
    }

    return success
  }, [fields, imageHooks, inputRefs, updateMetadata])

  return {
    isEditing,
    isSaving,
    imageHooks,
    inputRefs,
    startEditing,
    cancelEditing,
    saveChanges,
  }
}

