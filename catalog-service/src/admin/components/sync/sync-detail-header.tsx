import { useNavigate } from "react-router-dom"
import { Button, Text, Badge, IconButton, DropdownMenu, Copy, clx } from "@medusajs/ui"
import { ArrowLeft, EllipsisHorizontal, PencilSquare, Trash, PlaySolid, CheckCircleSolid, XCircleSolid, Spinner } from "@medusajs/icons"
import { useSyncDetail } from "./sync-detail-context"
import { MODULE_LABELS, MODULE_COLORS } from "./types"

const SyncIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

type SyncDetailHeaderProps = { hasRunningJob: boolean }

export function SyncDetailHeader({ hasRunningJob }: SyncDetailHeaderProps) {
  const navigate = useNavigate()
  const {
    config,
    running,
    isStreaming,
    setEditDrawerOpen,
    setDeleteDialogOpen,
    handleRunSync,
    handleToggleActive,
  } = useSyncDetail()

  if (!config) return null

  return (
    <div className="bg-white border-b border-ui-border-base">
      <div className="px-4 py-2 border-b border-ui-border-base flex items-center gap-3">
        <button
          onClick={() => navigate("/settings/sync")}
          className="flex items-center gap-1 text-ui-fg-muted hover:text-ui-fg-base text-sm"
        >
          <ArrowLeft className="h-4 w-4" /><span>Data Sync</span>
        </button>
        <div className="h-4 w-px bg-ui-border-base" />
        <button onClick={handleToggleActive} className="flex items-center gap-1.5">
          <div className={clx("w-2 h-2 rounded-full", config.is_active ? "bg-emerald-500" : "bg-gray-400")} />
          <span className="text-xs text-ui-fg-muted">{config.is_active ? "Active" : "Disabled"}</span>
        </button>
        <div className="h-4 w-px bg-ui-border-base" />
        <div className="flex items-center gap-1">
          <span className={clx("h-1.5 w-1.5 rounded-full", isStreaming ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
          <span className="text-xs text-ui-fg-muted">{isStreaming ? "Canlı" : "..."}</span>
        </div>
      </div>

      <div className="px-4 py-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <SyncIcon />
          </div>
          <div>
            <Text size="small" weight="plus">{config.name}</Text>
            <div className="flex items-center gap-1.5">
              <Badge color={MODULE_COLORS[config.module_type] ?? "grey"} size="xsmall">
                {MODULE_LABELS[config.module_type] ?? config.module_type}
              </Badge>
              <Text size="xsmall" className="text-ui-fg-muted font-mono">{config.target_url}</Text>
              <Copy content={config.target_url} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="small"
            onClick={handleRunSync}
            disabled={!config.is_active || running || hasRunningJob}
          >
            {running || hasRunningJob ? (
              <><Spinner className="animate-spin h-3 w-3 mr-1" />Çalışıyor</>
            ) : (
              <><PlaySolid className="h-3 w-3 mr-1" />Başlat</>
            )}
          </Button>
          <Button variant="secondary" size="small" onClick={() => setEditDrawerOpen(true)}>
            <PencilSquare className="h-3 w-3 mr-1" />Düzenle
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="transparent" size="small"><EllipsisHorizontal className="h-4 w-4" /></IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onClick={handleToggleActive}>
                {config.is_active ? <><XCircleSolid className="mr-2 h-3.5 w-3.5" />Pasif Et</> : <><CheckCircleSolid className="mr-2 h-3.5 w-3.5" />Aktif Et</>}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
                <Trash className="mr-2 h-3.5 w-3.5" />Sil
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
