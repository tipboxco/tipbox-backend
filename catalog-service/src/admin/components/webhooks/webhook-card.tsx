import { Container, Text, Badge, Button, IconButton, DropdownMenu, clx } from "@medusajs/ui"
import { 
  EllipsisHorizontal, 
  PencilSquare, 
  Trash, 
  PlaySolid, 
  ArrowUpRightOnBox,
  Spinner,
} from "@medusajs/icons"

type WebhookCardProps = {
  id: string
  eventNames: string[]
  targetUrl: string
  isActive: boolean
  stats?: {
    total_requests: number
    success_rate: number
  }
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  onNavigate: () => void
  testing?: boolean
}

export const WebhookCard = ({
  eventNames,
  targetUrl,
  isActive,
  stats,
  onEdit,
  onDelete,
  onTest,
  onNavigate,
  testing,
}: WebhookCardProps) => {
  return (
    <Container className="p-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-ui-border-base flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={clx(
            "w-2 h-2 rounded-full",
            isActive ? "bg-emerald-500" : "bg-gray-400"
          )} />
          <Badge color="blue" size="xsmall">
            {eventNames.length} event
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton variant="transparent" size="small">
              <EllipsisHorizontal className="h-4 w-4" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onNavigate}>
              <ArrowUpRightOnBox className="mr-2 h-3.5 w-3.5" />
              Detaylar
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={onEdit}>
              <PencilSquare className="mr-2 h-3.5 w-3.5" />
              Düzenle
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={onDelete} className="text-ui-fg-error">
              <Trash className="mr-2 h-3.5 w-3.5" />
              Sil
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="p-3">
        <Text size="small" className="text-ui-fg-muted font-mono truncate mb-2">
          {targetUrl}
        </Text>

        {stats && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-center p-2 bg-ui-bg-subtle rounded">
              <Text size="large" weight="plus">{stats.total_requests}</Text>
              <Text size="xsmall" className="text-ui-fg-muted">İstek</Text>
            </div>
            <div className="text-center p-2 bg-ui-bg-subtle rounded">
              <Text size="large" weight="plus" className={clx(
                stats.success_rate >= 80 ? "text-emerald-600" : 
                stats.success_rate >= 50 ? "text-amber-600" : "text-red-600"
              )}>
                {stats.success_rate}%
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">Başarı</Text>
            </div>
          </div>
        )}

        <Button variant="secondary" className="w-full" size="small" onClick={onTest} disabled={testing}>
          {testing ? (
            <><Spinner className="animate-spin h-3.5 w-3.5 mr-1" />Test Ediliyor...</>
          ) : (
            <><PlaySolid className="h-3.5 w-3.5 mr-1" />Test Et</>
          )}
        </Button>
      </div>
    </Container>
  )
}

