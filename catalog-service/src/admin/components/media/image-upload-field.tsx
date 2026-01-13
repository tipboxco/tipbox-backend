import { useState, useRef } from "react"
import { Button, Text, clx } from "@medusajs/ui"
import { ImagePreview } from "./image-preview"
import { MediaPickerDialog } from "./media-picker-dialog"
import { useImageUpload } from "./hooks/use-image-upload"
import type { MediaFieldConfig } from "./types"

type ImageUploadFieldProps = {
  /** Field configuration */
  config: MediaFieldConfig
  /** Current image value */
  value: string | null
  /** Whether editing mode is active */
  isEditing: boolean
  /** Whether saving is in progress */
  isSaving: boolean
  /** Callback when image changes */
  onChange: (value: string | null) => void
  /** Callback when image is removed */
  onRemove: () => void
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
}: ImageUploadFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleFileSelect, isUploading } = useImageUpload({
    onImageChange: onChange,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0] || null)
  }

  const handleButtonClick = () => {
    setPickerOpen(true)
  }

  const handlePickerSelect = (url: string) => {
    onChange(url)
    setPickerOpen(false)
  }

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

      <ImagePreview
        src={value}
        height={config.previewHeight || 32}
        alt={config.label}
        isEditing={isEditing}
        onRemove={onRemove}
      />

      {isEditing && (
        <div className="flex items-center gap-x-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
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
            {value ? "Değiştir" : "Kütüphaneden Seç"}
          </Button>
          {value && (
            <Button
              variant="transparent"
              size="small"
              onClick={() => inputRef.current?.click()}
              disabled={isSaving || isUploading}
              className="text-ui-fg-subtle hover:text-ui-fg-base"
            >
              Bilgisayardan Yükle
            </Button>
          )}
        </div>
      )}
      {!value && isEditing && (
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
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        selectedUrl={value}
      />
    </div>
  )
}
