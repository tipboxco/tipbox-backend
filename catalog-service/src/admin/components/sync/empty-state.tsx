import { Container, Heading, Text, Button } from "@medusajs/ui"

type EmptyStateProps = {
  icon: React.ReactNode
  heading: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState = ({ icon, heading, description, actionLabel, onAction }: EmptyStateProps) => (
  <Container className="py-12">
    <div className="flex flex-col items-center text-center">
      <div className="mb-2">{icon}</div>
      <Heading level="h2" className="text-sm mb-1">{heading}</Heading>
      {description && <Text size="xsmall" className="text-ui-fg-muted mb-3">{description}</Text>}
      {actionLabel && onAction && <Button variant="secondary" size="small" onClick={onAction}>{actionLabel}</Button>}
    </div>
  </Container>
)
