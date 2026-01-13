import { Photo } from "@medusajs/icons"
import { IconButton, clx } from "@medusajs/ui"
import { XMark } from "@medusajs/icons"

type ImagePreviewProps = {
  /** Image source (URL or base64) */
  src: string | null
  /** Preview height in Tailwind units (e.g., 32 = h-32) */
  height?: number
  /** Alt text */
  alt?: string
  /** Whether editing mode is active */
  isEditing?: boolean
  /** Callback when remove button is clicked */
  onRemove?: () => void
  /** Additional className */
  className?: string
}

/**
 * Image preview component with remove functionality
 * Follows Medusa design system guidelines
 */
export function ImagePreview({
  src,
  height = 32,
  alt = "Preview",
  isEditing = false,
  onRemove,
  className,
}: ImagePreviewProps) {
  // Map height to Tailwind classes
  const heightClass =
    height === 32 ? "h-32" : height === 48 ? "h-48" : height === 64 ? "h-64" : "h-32"

  if (src) {
    return (
      <div className={clx("relative group rounded-lg overflow-hidden", className)}>
        <div className={clx("w-full bg-ui-bg-subtle", heightClass)}>
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        {isEditing && onRemove && (
          <div className="absolute inset-0 bg-ui-bg-overlay/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <IconButton
              variant="transparent"
              size="small"
              onClick={onRemove}
              className="bg-ui-bg-base text-ui-fg-error hover:bg-ui-bg-base-hover hover:text-ui-fg-error-hover shadow-elevation-flyout"
            >
              <XMark className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={clx(
        "w-full border-2 border-dashed border-ui-border-base rounded-lg flex flex-col items-center justify-center bg-ui-bg-subtle transition-colors",
        heightClass,
        isEditing && "hover:border-ui-border-strong hover:bg-ui-bg-subtle-hover",
        className
      )}
    >
      <div className="flex flex-col items-center gap-y-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-ui-bg-component">
          <Photo
            className={clx(
              "text-ui-fg-muted",
              height <= 32 ? "h-5 w-5" : "h-6 w-6"
            )}
          />
        </div>
        {isEditing && (
          <p className="text-ui-fg-subtle text-xs text-center px-4">
            Resim yüklenmedi
          </p>
        )}
      </div>
    </div>
  )
}
