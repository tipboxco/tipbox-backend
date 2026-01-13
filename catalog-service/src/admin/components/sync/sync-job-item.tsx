import { Text, Badge, clx } from "@medusajs/ui"
import { CheckMini, XMark, Spinner, Clock } from "@medusajs/icons"

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

type SyncJobItemProps = {
  id: string
  status: JobStatus
  currentBatch: number
  totalBatches: number
  processedRecords: number
  totalRecords: number
  startedAt?: string | null
  createdAt: string
  isSelected?: boolean
  onClick?: () => void
}

const statusConfig: Record<JobStatus, { 
  Icon: React.ComponentType<{ className?: string }>
  bgColor: string
  iconColor: string
  badgeColor: "green" | "red" | "blue" | "orange" | "grey"
}> = {
  pending: { Icon: Clock, bgColor: "bg-gray-100", iconColor: "text-gray-600", badgeColor: "grey" },
  running: { Icon: Spinner, bgColor: "bg-blue-100", iconColor: "text-blue-600", badgeColor: "blue" },
  completed: { Icon: CheckMini, bgColor: "bg-emerald-100", iconColor: "text-emerald-600", badgeColor: "green" },
  failed: { Icon: XMark, bgColor: "bg-red-100", iconColor: "text-red-600", badgeColor: "red" },
  cancelled: { Icon: XMark, bgColor: "bg-amber-100", iconColor: "text-amber-600", badgeColor: "orange" },
}

export const SyncJobItem = ({
  status,
  currentBatch,
  totalBatches,
  processedRecords,
  totalRecords,
  startedAt,
  createdAt,
  isSelected,
  onClick,
}: SyncJobItemProps) => {
  const { Icon, bgColor, iconColor, badgeColor } = statusConfig[status] || statusConfig.pending
  const progress = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div
      onClick={onClick}
      className={clx(
        "flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-ui-border-base",
        isSelected ? "bg-cyan-50 border-l-2 border-l-cyan-600" : "hover:bg-ui-bg-subtle border-l-2 border-l-transparent"
      )}
    >
      <div className={clx("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", bgColor)}>
        <Icon className={clx("h-3.5 w-3.5", iconColor, status === "running" && "animate-spin")} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Text size="small" weight="plus">Batch {currentBatch}/{totalBatches}</Text>
          <Badge color={badgeColor} size="xsmall">{progress}%</Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Text size="xsmall" className="text-emerald-600">{processedRecords.toLocaleString()}</Text>
          <Text size="xsmall" className="text-ui-fg-muted">/</Text>
          <Text size="xsmall" className="text-ui-fg-muted">{totalRecords.toLocaleString()} kayıt</Text>
        </div>
      </div>
      
      <Text size="xsmall" className="text-ui-fg-muted font-mono flex-shrink-0">
        {formatTime(startedAt || createdAt)}
      </Text>
    </div>
  )
}

