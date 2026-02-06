import { Heading, Text, Badge, Copy, clx } from "@medusajs/ui"
import {
  CheckCircleSolid,
  XCircleSolid,
  Clock,
  Spinner,
  XMark,
} from "@medusajs/icons"

export type SeedLogLine = { type: "stdout" | "stderr"; line: string }

export type SeedJobDetailProps = {
  runId: string
  status: "running" | "completed" | "failed"
  startedAt: string
  completedAt?: string | null
  exitCode?: number
  logs: SeedLogLine[]
}

const statusConfig: Record<
  "running" | "completed" | "failed",
  {
    label: string
    Icon: React.ComponentType<{ className?: string }>
    bgColor: string
    textColor: string
  }
> = {
  running: {
    label: "Çalışıyor",
    Icon: Spinner,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  completed: {
    label: "Tamamlandı",
    Icon: CheckCircleSolid,
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
  failed: {
    label: "Başarısız",
    Icon: XCircleSolid,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
  },
}

export const SeedJobDetail = ({
  runId,
  status,
  startedAt,
  completedAt,
  exitCode,
  logs,
}: SeedJobDetailProps) => {
  const config = statusConfig[status]

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={clx(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              config.bgColor
            )}
          >
            <config.Icon
              className={clx(
                "h-4 w-4",
                config.textColor,
                status === "running" && "animate-spin"
              )}
            />
          </div>
          <div>
            <Heading level="h2" className="text-base">
              Seed Run
            </Heading>
            <div className="flex items-center gap-1">
              <Text size="xsmall" className="text-ui-fg-muted font-mono">
                {runId}
              </Text>
              <Copy content={runId} />
            </div>
          </div>
        </div>
        <Badge
          color={
            status === "completed"
              ? "green"
              : status === "failed"
                ? "red"
                : "blue"
          }
          size="small"
        >
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">
            Başladı
          </Text>
          <Text size="xsmall">{formatDate(startedAt)}</Text>
        </div>
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">
            Bitti
          </Text>
          <Text size="xsmall">{formatDate(completedAt)}</Text>
        </div>
        {exitCode !== undefined && (
          <div className="p-2 bg-ui-bg-subtle rounded col-span-2">
            <Text size="xsmall" className="text-ui-fg-muted">
              Çıkış kodu
            </Text>
            <Text
              size="xsmall"
              weight="plus"
              className={exitCode === 0 ? "text-emerald-600" : "text-red-600"}
            >
              {exitCode}
            </Text>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-ui-border-base overflow-hidden bg-ui-bg-subtle">
        <div className="px-3 py-2 border-b border-ui-border-base bg-ui-bg-base">
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
            Log ({logs.length} satır)
          </Text>
        </div>
        <div className="p-3 max-h-[360px] overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap break-words m-0">
            {logs.length === 0 && status === "running" && (
              <span className="text-ui-fg-muted">Log bekleniyor...</span>
            )}
            {logs.map(({ type, line }, i) => (
              <div
                key={i}
                className={clx(
                  type === "stderr" && "text-red-600"
                )}
              >
                {line}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}
