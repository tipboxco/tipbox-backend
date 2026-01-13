import { Heading, Text, Button } from "@medusajs/ui"
import { ReactNode } from "react"

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-3">
        {icon}
      </div>
      <Heading level="h3" className="text-sm mb-1">{title}</Heading>
      {description && (
        <Text size="small" className="text-ui-fg-muted max-w-xs mb-3">
          {description}
        </Text>
      )}
      {action && (
        <Button variant="secondary" size="small" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

