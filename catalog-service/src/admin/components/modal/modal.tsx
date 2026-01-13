import { ReactNode } from "react"
import { Heading, Text, IconButton, clx } from "@medusajs/ui"
import { XMark } from "@medusajs/icons"

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full"

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  full: "max-w-[95vw]",
}

type ModalProps = {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Modal title */
  title?: string
  /** Modal description */
  description?: string
  /** Modal content */
  children: ReactNode
  /** Modal size */
  size?: ModalSize
  /** Whether to show the close button */
  showCloseButton?: boolean
  /** Custom class name for the modal container */
  className?: string
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdropClick?: boolean
}

/**
 * A reusable modal component with consistent styling
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  size = "lg",
  showCloseButton = true,
  className,
  closeOnBackdropClick = true,
}: ModalProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ui-bg-overlay"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />
      
      {/* Modal Container */}
      <div 
        className={clx(
          "relative bg-ui-bg-base rounded-lg shadow-elevation-modal w-full flex flex-col overflow-hidden",
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
            <div>
              {title && (
                <Heading level="h2" className="text-ui-fg-base">{title}</Heading>
              )}
              {description && (
                <Text size="small" className="text-ui-fg-subtle mt-0.5">
                  {description}
                </Text>
              )}
            </div>
            {showCloseButton && (
              <IconButton variant="transparent" size="small" onClick={onClose}>
                <XMark className="h-5 w-5" />
              </IconButton>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  )
}

type ModalBodyProps = {
  children: ReactNode
  className?: string
}

/**
 * Modal body component
 */
export const ModalBody = ({ children, className }: ModalBodyProps) => (
  <div className={clx("flex-1 overflow-y-auto min-h-0 px-6 py-6", className)}>
    {children}
  </div>
)

type ModalFooterProps = {
  children: ReactNode
  className?: string
}

/**
 * Modal footer component
 */
export const ModalFooter = ({ children, className }: ModalFooterProps) => (
  <div className={clx("flex-shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle", className)}>
    {children}
  </div>
)

