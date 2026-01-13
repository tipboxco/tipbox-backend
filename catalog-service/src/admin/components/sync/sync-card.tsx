import { Container, Text, Badge, Button, IconButton, DropdownMenu, clx } from "@medusajs/ui"
import { 
  EllipsisHorizontal, 
  PencilSquare, 
  Trash, 
  PlaySolid, 
  ArrowUpRightOnBox,
  Spinner,
  Clock,
} from "@medusajs/icons"

type ModuleType = "product" | "category" | "brand"

type SyncCardProps = {
  id: string
  name: string
  moduleType: ModuleType
  targetUrl: string
  isActive: boolean
  lastSyncAt?: string | null
  stats?: {
    total_jobs: number
    success_rate: number
    total_records_synced: number
    running_jobs: number
  }
  onEdit: () => void
  onDelete: () => void
  onRun: () => void
  onNavigate: () => void
  running?: boolean
}

const MODULE_LABELS: Record<ModuleType, string> = {
  product: "Ürünler",
  category: "Kategoriler",
  brand: "Markalar",
}

const MODULE_COLORS: Record<ModuleType, "blue" | "green" | "purple"> = {
  product: "blue",
  category: "green",
  brand: "purple",
}

export const SyncCard = ({
  name,
  moduleType,
  targetUrl,
  isActive,
  lastSyncAt,
  stats,
  onEdit,
  onDelete,
  onRun,
  onNavigate,
  running,
}: SyncCardProps) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Hiç"
    return new Date(dateString).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isRunning = running || (stats?.running_jobs || 0) > 0

  return (
    <Container className="p-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-ui-border-base flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color={MODULE_COLORS[moduleType]} size="xsmall">
            {MODULE_LABELS[moduleType]}
          </Badge>
          <div className={clx(
            "w-2 h-2 rounded-full",
            isActive ? "bg-emerald-500" : "bg-gray-400"
          )} />
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
        <Text size="small" weight="plus" className="mb-0.5">{name}</Text>
        <Text size="xsmall" className="text-ui-fg-muted font-mono truncate mb-2">
          {targetUrl}
        </Text>

        {stats && (
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
              <Text size="large" weight="plus">{stats.total_jobs}</Text>
              <Text size="xsmall" className="text-ui-fg-muted">Job</Text>
            </div>
            <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
              <Text size="large" weight="plus" className={clx(
                stats.success_rate >= 80 ? "text-emerald-600" : 
                stats.success_rate >= 50 ? "text-amber-600" : "text-red-600"
              )}>
                {stats.success_rate}%
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">Başarı</Text>
            </div>
            <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
              <Text size="large" weight="plus">{stats.total_records_synced.toLocaleString()}</Text>
              <Text size="xsmall" className="text-ui-fg-muted">Kayıt</Text>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1 text-ui-fg-muted">
            <Clock className="h-3 w-3" />
            <span>Son sync:</span>
          </div>
          <Text size="xsmall">{formatDate(lastSyncAt)}</Text>
        </div>

        <Button 
          variant="secondary" 
          className="w-full" 
          size="small" 
          onClick={onRun} 
          disabled={!isActive || isRunning}
        >
          {isRunning ? (
            <><Spinner className="animate-spin h-3.5 w-3.5 mr-1" />Çalışıyor...</>
          ) : (
            <><PlaySolid className="h-3.5 w-3.5 mr-1" />Sync Başlat</>
          )}
        </Button>
      </div>
    </Container>
  )
}

