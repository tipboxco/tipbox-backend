import { Text, clx } from "@medusajs/ui"

type StatsCardProps = {
  label: string
  value: string | number
  color?: "default" | "success" | "warning" | "danger"
  size?: "sm" | "md"
}

const colorMap = {
  default: "text-ui-fg-base",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
}

export const StatsCard = ({ 
  label, 
  value, 
  color = "default",
  size = "md" 
}: StatsCardProps) => {
  return (
    <div className={clx(
      "text-center rounded bg-ui-bg-subtle",
      size === "sm" ? "p-2" : "p-3"
    )}>
      <Text 
        size={size === "sm" ? "large" : "xlarge"} 
        weight="plus" 
        className={colorMap[color]}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted">{label}</Text>
    </div>
  )
}

