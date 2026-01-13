import { ReactNode } from "react"
import { Text, Button, clx } from "@medusajs/ui"
import { PlusMini } from "@medusajs/icons"

type EmptyStateProps = {
  /** Icon to display */
  icon?: ReactNode
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Action button text */
  actionLabel?: string
  /** Action button callback */
  onAction?: () => void
  /** Custom class name */
  className?: string
}

/**
 * A reusable empty state component for when there's no data to display
 */
export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) => (
  <div className={clx("flex flex-col items-center justify-center py-16", className)}>
    {icon && (
      <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
        {icon}
      </div>
    )}
    <Text weight="plus" className="text-ui-fg-base mb-1">
      {title}
    </Text>
    {description && (
      <Text size="small" className="text-ui-fg-subtle mb-4 text-center max-w-sm">
        {description}
      </Text>
    )}
    {actionLabel && onAction && (
      <Button variant="secondary" size="small" onClick={onAction}>
        <PlusMini />
        {actionLabel}
      </Button>
    )}
  </div>
)

