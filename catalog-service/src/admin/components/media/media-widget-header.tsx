import { Text, IconButton, Skeleton } from "@medusajs/ui"
import { Photo, PencilSquare, Check, XMark, Spinner } from "@medusajs/icons"
import { clx } from "@medusajs/ui"

type MediaWidgetHeaderProps = {
  /** Widget title */
  title?: string
  /** Whether editing mode is active */
  isEditing: boolean
  /** Whether saving is in progress */
  isSaving: boolean
  /** Callback when edit button is clicked */
  onEdit: () => void
  /** Callback when save button is clicked */
  onSave: () => void
  /** Callback when cancel button is clicked */
  onCancel: () => void
}

/**
 * Media widget header component
 * Follows Medusa design system guidelines
 */
export function MediaWidgetHeader({
  title = "Medya",
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: MediaWidgetHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-x-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component">
          <Photo className="h-4 w-4 text-ui-fg-muted" />
        </div>
        <div className="flex flex-col gap-y-0.5">
          <Text size="small" weight="plus" className="text-ui-fg-base">
            {title}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {isEditing ? "Düzenleniyor" : "Görüntüleniyor"}
          </Text>
        </div>
      </div>
      {!isEditing ? (
        <IconButton
          variant="transparent"
          size="small"
          onClick={onEdit}
          className="text-ui-fg-subtle hover:text-ui-fg-base"
        >
          <PencilSquare className="h-4 w-4" />
        </IconButton>
      ) : (
        <div className="flex items-center gap-x-1">
          {isSaving && (
            <Spinner className="h-4 w-4 animate-spin text-ui-fg-muted" />
          )}
          <IconButton
            variant="transparent"
            size="small"
            onClick={onSave}
            disabled={isSaving}
            className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </IconButton>
          <IconButton
            variant="transparent"
            size="small"
            onClick={onCancel}
            disabled={isSaving}
            className="text-ui-fg-subtle hover:text-ui-fg-base disabled:opacity-50"
          >
            <XMark className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  )
}
