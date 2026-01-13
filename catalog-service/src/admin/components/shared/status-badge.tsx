import { Badge, clx } from "@medusajs/ui"
import { 
  CheckCircleSolid, 
  XCircleSolid, 
  Clock, 
  Spinner,
  XMark,
} from "@medusajs/icons"

export type StatusType = "success" | "failed" | "pending" | "running" | "cancelled"

type StatusBadgeProps = {
  status: StatusType
  showIcon?: boolean
  size?: "xsmall" | "small"
}

const statusConfig: Record<StatusType, { 
  label: string
  color: "green" | "red" | "grey" | "blue" | "orange"
  Icon: React.ComponentType<{ className?: string }>
}> = {
  success: { label: "Başarılı", color: "green", Icon: CheckCircleSolid },
  failed: { label: "Başarısız", color: "red", Icon: XCircleSolid },
  pending: { label: "Bekliyor", color: "grey", Icon: Clock },
  running: { label: "Çalışıyor", color: "blue", Icon: Spinner },
  cancelled: { label: "İptal", color: "orange", Icon: XMark },
}

// Alias mappings for different naming conventions
const statusAliases: Record<string, StatusType> = {
  completed: "success",
}

export const StatusBadge = ({ 
  status, 
  showIcon = false, 
  size = "small" 
}: StatusBadgeProps) => {
  const normalizedStatus = statusAliases[status] || status
  const config = statusConfig[normalizedStatus as StatusType] || statusConfig.pending
  const { label, color, Icon } = config

  return (
    <Badge color={color} size={size} className={showIcon ? "flex items-center gap-1" : ""}>
      {showIcon && (
        <Icon className={clx(
          "h-3 w-3",
          status === "running" && "animate-spin"
        )} />
      )}
      {label}
    </Badge>
  )
}

export const StatusIcon = ({ 
  status, 
  className = "h-4 w-4" 
}: { status: StatusType; className?: string }) => {
  const normalizedStatus = statusAliases[status] || status
  const config = statusConfig[normalizedStatus as StatusType] || statusConfig.pending
  const { Icon, color } = config

  const colorClass = {
    green: "text-emerald-600",
    red: "text-red-600",
    grey: "text-gray-600",
    blue: "text-blue-600",
    orange: "text-amber-600",
  }[color]

  return (
    <Icon className={clx(
      className,
      colorClass,
      status === "running" && "animate-spin"
    )} />
  )
}

