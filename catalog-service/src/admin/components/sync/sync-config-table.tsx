import { useNavigate } from "react-router-dom"
import { Container, Table, Checkbox, Button, Text, Badge, clx } from "@medusajs/ui"
import { PencilSquare, Trash, PlaySolid, Spinner, ArrowUpRightOnBox } from "@medusajs/icons"
import type { SyncConfig } from "./types"
import { MODULE_LABELS, MODULE_COLORS, formatSyncDate } from "./types"

type SyncConfigTableProps = {
  configs: SyncConfig[]
  selectedIds: Set<string>
  runningIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onRun: (config: SyncConfig) => void
  onEdit: (config: SyncConfig) => void
  onDelete: (config: SyncConfig) => void
}

export const SyncConfigTable = ({
  configs,
  selectedIds,
  runningIds,
  onToggleSelect,
  onToggleSelectAll,
  onRun,
  onEdit,
  onDelete,
}: SyncConfigTableProps) => {
  const navigate = useNavigate()
  const isAllSelected = configs.length > 0 && selectedIds.size === configs.length

  return (
    <Container className="p-0">
      <Table>
        <Table.Header>
          <Table.Row className="bg-ui-bg-subtle">
            <Table.HeaderCell className="w-10 pl-4">
              {configs.length > 0 && (
                <Checkbox checked={isAllSelected} onCheckedChange={onToggleSelectAll} aria-label="Tümünü seç" />
              )}
            </Table.HeaderCell>
            <Table.HeaderCell className="pl-4">Ad</Table.HeaderCell>
            <Table.HeaderCell>Tip</Table.HeaderCell>
            <Table.HeaderCell>Durum</Table.HeaderCell>
            <Table.HeaderCell>URL</Table.HeaderCell>
            <Table.HeaderCell className="text-center">Job</Table.HeaderCell>
            <Table.HeaderCell className="text-center">Başarı</Table.HeaderCell>
            <Table.HeaderCell className="text-center">Kayıt</Table.HeaderCell>
            <Table.HeaderCell>Son sync</Table.HeaderCell>
            <Table.HeaderCell className="text-right w-[180px]">İşlem</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {configs.map((config) => {
            const isRunning = runningIds.has(config.id) || (config.stats?.running_jobs || 0) > 0
            const isBackendSeed = config.module_type === "backend_seed"
            const isSelected = selectedIds.has(config.id)
            return (
              <Table.Row key={config.id} className={isSelected ? "bg-ui-bg-highlight" : undefined}>
                <Table.Cell className="w-10 pl-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(config.id)}
                    aria-label={`${config.name} seç`}
                  />
                </Table.Cell>
                <Table.Cell className="pl-4">
                  <Text size="small" weight="plus">{config.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={MODULE_COLORS[config.module_type] ?? "grey"} size="xsmall">
                    {MODULE_LABELS[config.module_type] ?? config.module_type}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className={clx("w-2 h-2 rounded-full", config.is_active ? "bg-emerald-500" : "bg-gray-400")} title={config.is_active ? "Aktif" : "Pasif"} />
                </Table.Cell>
                <Table.Cell>
                  <Text size="xsmall" className="text-ui-fg-muted font-mono max-w-[200px] truncate block" title={config.target_url}>
                    {config.target_url}
                  </Text>
                </Table.Cell>
                <Table.Cell className="text-center">{config.stats != null ? config.stats.total_jobs : "—"}</Table.Cell>
                <Table.Cell className="text-center">
                  {config.stats != null ? (
                    <span className={clx(
                      config.stats.success_rate >= 80 ? "text-emerald-600" : config.stats.success_rate >= 50 ? "text-amber-600" : "text-red-600"
                    )}>
                      {config.stats.success_rate}%
                    </span>
                  ) : "—"}
                </Table.Cell>
                <Table.Cell className="text-center">
                  {config.stats != null ? config.stats.total_records_synced.toLocaleString() : "—"}
                </Table.Cell>
                <Table.Cell>
                  <Text size="xsmall">{formatSyncDate(config.last_sync_at)}</Text>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="transparent" size="small" onClick={() => navigate(`/settings/sync/${config.id}`)}>
                      <ArrowUpRightOnBox className="h-3.5 w-3.5 mr-1" />Detay
                    </Button>
                    {!isBackendSeed && (
                      <Button variant="transparent" size="small" onClick={() => onEdit(config)}>
                        <PencilSquare className="h-3.5 w-3.5 mr-1" />Düzenle
                      </Button>
                    )}
                    <Button variant="transparent" size="small" onClick={() => onDelete(config)} className="text-ui-fg-error">
                      <Trash className="h-3.5 w-3.5 mr-1" />Sil
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onRun(config)}
                      disabled={!config.is_active || isRunning}
                    >
                      {isRunning ? <Spinner className="animate-spin h-3.5 w-3.5 mr-1" /> : <PlaySolid className="h-3.5 w-3.5 mr-1" />}
                      {isRunning ? "Çalışıyor" : "Başlat"}
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </Container>
  )
}
