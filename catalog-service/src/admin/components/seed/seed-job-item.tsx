import { Text, Badge, clx } from "@medusajs/ui"
import { CheckMini, XMark, Spinner, Clock } from "@medusajs/icons"

export type SeedRunStatus = "running" | "completed" | "failed"

export type SeedJobItemProps = {
  id: string
  status: SeedRunStatus
  startedAt: string
  logCount: number
  exitCode?: number
  isSelected?: boolean
  onClick?: () => void
}

const statusConfig: Record<
  SeedRunStatus,
  {
    Icon: React.ComponentType<{ className?: string }>
    bgColor: string
    iconColor: string
    badgeColor: "green" | "red" | "blue" | "orange" | "grey"
  }
> = {
  running: {
    Icon: Spinner,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    badgeColor: "blue",
  },
  completed: {
    Icon: CheckMini,
    bgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
    badgeColor: "green",
  },
  failed: {
    Icon: XMark,
    bgColor: "bg-red-100",
    iconColor: "text-red-600",
    badgeColor: "red",
  },
}

export const SeedJobItem = ({
  id,
  status,
  startedAt,
  logCount,
  isSelected,
  onClick,
}: SeedJobItemProps) => {
  const { Icon, bgColor, iconColor, badgeColor } = statusConfig[status]

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const shortId = id.length > 12 ? id.slice(0, 8) + "…" : id

  return (
    <div
      onClick={onClick}
      className={clx(
        "flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-ui-border-base",
        isSelected
          ? "bg-cyan-50 border-l-2 border-l-cyan-600"
          : "hover:bg-ui-bg-subtle border-l-2 border-l-transparent"
      )}
    >
      <div
        className={clx(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
          bgColor
        )}
      >
        <Icon
          className={clx(
            "h-3.5 w-3.5",
            iconColor,
            status === "running" && "animate-spin"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Text size="small" weight="plus" className="font-mono">
            {shortId}
          </Text>
          <Badge color={badgeColor} size="xsmall">
            {status === "running" ? "Çalışıyor" : status === "completed" ? "Tamamlandı" : "Hata"}
          </Badge>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {logCount} log satırı
        </Text>
      </div>

      <Text
        size="xsmall"
        className="text-ui-fg-muted font-mono flex-shrink-0"
      >
        {formatTime(startedAt)}
      </Text>
    </div>
  )
}
