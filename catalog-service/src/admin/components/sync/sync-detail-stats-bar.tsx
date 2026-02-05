import { Text, clx } from "@medusajs/ui"
import { useSyncDetail } from "./sync-detail-context"
import { formatSyncDate } from "./types"

export function SyncDetailStatsBar() {
  const { config, stats } = useSyncDetail()
  if (!config || !stats) return null

  return (
    <div className="px-4 py-2.5 bg-ui-bg-subtle border-t border-ui-border-base">
      <div className="flex items-center gap-4">
        <div>
          <Text size="xsmall" className="text-ui-fg-muted">Jobs</Text>
          <Text size="small" weight="plus">{stats.total_jobs}</Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted">Success</Text>
          <Text
            size="small"
            weight="plus"
            className={clx(
              stats.success_rate >= 80 ? "text-emerald-600" : stats.success_rate >= 50 ? "text-amber-600" : "text-red-600"
            )}
          >
            {stats.success_rate}%
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted">Records</Text>
          <Text size="small" weight="plus">{stats.total_records_synced.toLocaleString()}</Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted">Batch</Text>
          <Text size="small" weight="plus">{config.batch_size.toLocaleString()}</Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-muted">Last</Text>
          <Text size="xsmall">{formatSyncDate(config.last_sync_at) || "Never"}</Text>
        </div>
      </div>
    </div>
  )
}
