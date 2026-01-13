import { Container, Skeleton } from "@medusajs/ui"
import { Photo } from "@medusajs/icons"
import { MediaWidgetHeader } from "./media-widget-header"
import { ImageUploadField } from "./image-upload-field"
import { useMediaEditor } from "./hooks/use-media-editor"
import type { MediaWidgetConfig } from "./types"

type MediaWidgetProps = {
  /** Widget configuration */
  config: MediaWidgetConfig
  /** Loading state */
  loading?: boolean
}

/**
 * Reusable media widget component
 * Can be used for any entity type (category, product, etc.)
 * Follows Medusa design system guidelines
 */
export function MediaWidget({ config, loading = false }: MediaWidgetProps) {
  const {
    isEditing,
    isSaving,
    imageHooks,
    startEditing,
    cancelEditing,
    saveChanges,
  } = useMediaEditor(config)

  if (loading) {
    return (
      <Container className="p-0 divide-y">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-3">
            <Photo className="h-5 w-5 text-ui-fg-muted" />
            <div className="flex flex-col gap-y-0.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="px-6 py-4 space-y-6">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          ))}
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-0 divide-y">
      <MediaWidgetHeader
        title="Medya"
        isEditing={isEditing}
        isSaving={isSaving}
        onEdit={startEditing}
        onSave={saveChanges}
        onCancel={cancelEditing}
      />

      <div className="px-6 py-6 space-y-6">
        {config.fields.map((field) => {
          const hook = imageHooks[field.key]
          return (
            <ImageUploadField
              key={field.key}
              config={field}
              value={hook.image}
              isEditing={isEditing}
              isSaving={isSaving}
              onChange={(value) => hook.setImageValue(value)}
              onRemove={hook.clearImage}
            />
          )
        })}
      </div>
    </Container>
  )
}
