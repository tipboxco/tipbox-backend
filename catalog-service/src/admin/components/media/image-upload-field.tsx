import { useState, useRef } from "react"
import { Button, Text, clx } from "@medusajs/ui"
import { ImagePreview } from "./image-preview"
import { MediaPickerDialog } from "./media-picker-dialog"
import { useImageUpload } from "./hooks/use-image-upload"
import type { MediaFieldConfig } from "./types"

type ImageUploadFieldProps = {
  /** Field configuration */
  config: MediaFieldConfig
  /** Current image value (single or multiple) */
  value: string | string[] | null
  /** Whether editing mode is active */
  isEditing: boolean
  /** Whether saving is in progress */
  isSaving: boolean
  /** Callback when image changes */
  onChange: (value: string | string[] | null) => void
  /** Callback when image is removed */
  onRemove: (index?: number) => void
  /** Whether to allow multiple file uploads */
  multiple?: boolean
}

/**
 * Reusable image upload field component
 * Follows Medusa design system guidelines
 */
export function ImageUploadField({
  config,
  value,
  isEditing,
  isSaving,
  onChange,
  onRemove,
  multiple = false,
}: ImageUploadFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleFileSelect, handleMultipleFileSelect, isUploading } = useImageUpload({
    onImageChange: onChange,
    multiple,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (multiple) {
      handleMultipleFileSelect(Array.from(files))
    } else {
      handleFileSelect(files[0] || null)
    }
  }

  const handleButtonClick = () => {
    setPickerOpen(true)
  }

  const handlePickerSelect = (url: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : value ? [value] : []
      if (!currentValues.includes(url)) {
        onChange([...currentValues, url])
      }
    } else {
      onChange(url)
      setPickerOpen(false)
    }
  }

  const handlePickerClose = (selectedUrls?: string[]) => {
    if (multiple && selectedUrls && selectedUrls.length > 0) {
      const currentValues = Array.isArray(value) ? value : value ? [value] : []
      const newValues = [...currentValues, ...selectedUrls.filter(url => !currentValues.includes(url))]
      onChange(newValues.length > 0 ? newValues : null)
    }
    setPickerOpen(false)
  }

  const handleRemove = (index?: number) => {
    if (multiple && typeof index === 'number') {
      const currentValues = Array.isArray(value) ? value : value ? [value] : []
      const newValues = currentValues.filter((_, i) => i !== index)
      onChange(newValues.length > 0 ? newValues : null)
    } else {
      onRemove(index)
    }
  }

  const currentValues = multiple 
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (Array.isArray(value) ? value[0] : value)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Text size="small" weight="plus" className="text-ui-fg-base">
          {config.label}
        </Text>
        {config.required && (
          <Text size="xsmall" className="text-ui-fg-error">
            Zorunlu
          </Text>
        )}
      </div>

      {multiple ? (
        <div className="space-y-2">
          {currentValues.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentValues.map((src, index) => (
                <ImagePreview
                  key={index}
                  src={src}
                  height={config.previewHeight || 32}
                  alt={`${config.label} ${index + 1}`}
                  isEditing={isEditing}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </div>
          ) : (
            <ImagePreview
              src={null}
              height={config.previewHeight || 32}
              alt={config.label}
              isEditing={isEditing}
              onRemove={() => handleRemove()}
            />
          )}
        </div>
      ) : (
        <ImagePreview
          src={currentValues}
          height={config.previewHeight || 32}
          alt={config.label}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      )}

      {isEditing && (
        <div className="flex items-center gap-x-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple={true}
            onChange={handleInputChange}
            className="hidden"
            id={`${config.key}-upload`}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={handleButtonClick}
            disabled={isSaving || isUploading}
            className="flex-1"
          >
            {multiple 
              ? (currentValues.length > 0 ? "Daha Fazla Ekle" : "Kütüphaneden Seç")
              : (currentValues ? "Değiştir" : "Kütüphaneden Seç")
            }
          </Button>
          <Button
            variant="transparent"
            size="small"
            onClick={() => inputRef.current?.click()}
            disabled={isSaving || isUploading}
            className="text-ui-fg-subtle hover:text-ui-fg-base"
          >
            {multiple ? "Bilgisayardan Yükle" : "Bilgisayardan Yükle"}
          </Button>
        </div>
      )}
      {!currentValues && isEditing && (
        <Button
          variant="transparent"
          size="small"
          onClick={() => inputRef.current?.click()}
          disabled={isSaving || isUploading}
          className="w-full text-ui-fg-subtle hover:text-ui-fg-base"
        >
          Bilgisayardan Yükle
        </Button>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onClose={handlePickerClose}
        onSelect={handlePickerSelect}
        selectedUrl={multiple ? undefined : (Array.isArray(value) ? value[0] : value)}
        multiple={multiple}
      />
    </div>
  )
}
