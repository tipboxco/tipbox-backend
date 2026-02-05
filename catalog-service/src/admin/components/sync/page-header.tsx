import { Container, Heading, Text, Button, clx } from "@medusajs/ui"

type PageHeaderProps = {
  icon: React.ReactNode
  title: string
  subtitle?: string
  badge?: { label: string; active?: boolean }
  actions?: React.ReactNode
}

export const PageHeader = ({ icon, title, subtitle, badge, actions }: PageHeaderProps) => (
  <Container className="p-0">
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <Heading level="h1" className="text-base">{title}</Heading>
          {subtitle && <Text size="xsmall" className="text-ui-fg-muted">{subtitle}</Text>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <div className="flex items-center gap-1">
            <span className={clx("h-1.5 w-1.5 rounded-full", badge.active ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
            <Text size="xsmall" className="text-ui-fg-muted">{badge.label}</Text>
          </div>
        )}
        {actions}
      </div>
    </div>
  </Container>
)
