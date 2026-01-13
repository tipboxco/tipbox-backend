import { Container, Heading, Text, Button, IconButton, clx } from "@medusajs/ui"
import { ArrowLeft, PlusMini } from "@medusajs/icons"
import { ReactNode } from "react"

type PageHeaderProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  backLink?: { label: string; onClick: () => void }
  actions?: ReactNode
  statusIndicator?: ReactNode
  isStreaming?: boolean
}

export const PageHeader = ({
  title,
  subtitle,
  icon,
  backLink,
  actions,
  statusIndicator,
  isStreaming,
}: PageHeaderProps) => {
  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {backLink && (
            <>
              <button 
                onClick={backLink.onClick}
                className="flex items-center gap-1.5 text-ui-fg-muted hover:text-ui-fg-base text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLink.label}
              </button>
              <div className="h-4 w-px bg-ui-border-base" />
            </>
          )}
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white">
              {icon}
            </div>
          )}
          <div>
            <Heading level="h1" className="text-base">{title}</Heading>
            {subtitle && (
              <Text size="small" className="text-ui-fg-muted">{subtitle}</Text>
            )}
          </div>
          {statusIndicator}
        </div>
        <div className="flex items-center gap-2">
          {isStreaming !== undefined && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className={clx(
                "h-2 w-2 rounded-full",
                isStreaming ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
              )} />
              <Text size="xsmall" className="text-ui-fg-muted">
                {isStreaming ? "Canlı" : "Bağlanıyor..."}
              </Text>
            </div>
          )}
          {actions}
        </div>
      </div>
    </Container>
  )
}

type AddButtonProps = {
  label: string
  onClick: () => void
}

export const AddButton = ({ label, onClick }: AddButtonProps) => (
  <Button variant="primary" size="small" onClick={onClick}>
    <PlusMini className="h-4 w-4 mr-1" />
    {label}
  </Button>
)

