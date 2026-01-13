import { Text, Badge, clx } from "@medusajs/ui"
import { CheckCircleSolid, XCircleSolid, Spinner, Clock } from "@medusajs/icons"

type WebhookLogStatus = "success" | "failed" | "pending"

type LogItemProps = {
  id: string
  eventName: string
  status: WebhookLogStatus
  statusCode?: number | null
  durationMs?: number | null
  errorMessage?: string | null
  triggeredAt: string
  isSelected?: boolean
  onClick?: () => void
}

const statusConfig = {
  success: { Icon: CheckCircleSolid, color: "text-emerald-500", bgColor: "bg-emerald-50" },
  failed: { Icon: XCircleSolid, color: "text-rose-500", bgColor: "bg-rose-50" },
  pending: { Icon: Clock, color: "text-gray-500", bgColor: "bg-gray-50" },
}

export const WebhookLogItem = ({
  eventName,
  status,
  statusCode,
  durationMs,
  errorMessage,
  triggeredAt,
  isSelected,
  onClick,
}: LogItemProps) => {
  const { Icon, color, bgColor } = statusConfig[status] || statusConfig.pending

  const formatDuration = (ms?: number | null) => {
    if (!ms) return "-"
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (dateString: string) => {
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
        "flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-ui-border-base",
        isSelected ? "bg-violet-50 border-l-2 border-l-violet-500" : "hover:bg-ui-bg-subtle border-l-2 border-l-transparent"
      )}
    >
      <div className={clx("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", bgColor)}>
        <Icon className={clx("h-3.5 w-3.5", color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Text size="small" weight="plus" className="truncate">{eventName}</Text>
          <Badge color={status === "success" ? "green" : "red"} size="xsmall">
            {statusCode || "-"}
          </Badge>
        </div>
        {errorMessage && (
          <Text size="xsmall" className="text-rose-500 truncate">{errorMessage}</Text>
        )}
        <Text size="xsmall" className="text-ui-fg-muted">
          {formatDuration(durationMs)} • {formatTime(triggeredAt)}
        </Text>
      </div>
    </div>
  )
}

