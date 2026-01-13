import { Heading, Text, Badge, Button, Copy, clx } from "@medusajs/ui"
import { CheckCircleSolid, XCircleSolid, ArrowUturnLeft } from "@medusajs/icons"

type WebhookLog = {
  id: string
  event_name: string
  target_url: string
  status: "success" | "failed" | "pending"
  status_code?: number | null
  duration_ms?: number | null
  request_body?: Record<string, unknown> | null
  response_body?: string | null
  error_message?: string | null
  triggered_at: string
}

type WebhookLogDetailProps = {
  log: WebhookLog
  onResend?: () => void
}

export const WebhookLogDetail = ({ log, onResend }: WebhookLogDetailProps) => {
  const formatDuration = (ms?: number | null) => {
    if (!ms) return "-"
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatJson = (data: unknown) => {
    try {
      if (typeof data === "string") {
        return JSON.stringify(JSON.parse(data), null, 2)
      }
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {log.status === "success" ? (
            <CheckCircleSolid className="h-5 w-5 text-emerald-500" />
          ) : (
            <XCircleSolid className="h-5 w-5 text-rose-500" />
          )}
          <div>
            <Heading level="h2" className="text-base">{log.event_name}</Heading>
            <Text size="xsmall" className="text-ui-fg-muted">
              {log.status === "success" ? "Başarılı" : "Başarısız"} ({log.status_code || "-"})
            </Text>
          </div>
        </div>
        {onResend && (
          <Button variant="secondary" size="small" onClick={onResend}>
            <ArrowUturnLeft className="h-3.5 w-3.5 mr-1" />
            Yeniden Gönder
          </Button>
        )}
      </div>

      {/* Response */}
      <div>
        <Text size="small" weight="plus" className="mb-2">Response</Text>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <Text size="xsmall" className="text-ui-fg-muted">HTTP Status</Text>
            <Badge color={log.status === "success" ? "green" : "red"} size="small">
              {log.status_code || "-"}
            </Badge>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-muted">Duration</Text>
            <Text size="small">{formatDuration(log.duration_ms)}</Text>
          </div>
        </div>
        {log.error_message && (
          <div className="mb-2">
            <Text size="xsmall" className="text-ui-fg-muted">Error</Text>
            <pre className="bg-rose-900 text-rose-100 p-2 rounded text-xs overflow-auto max-h-24">
              {log.error_message}
            </pre>
          </div>
        )}
        {log.response_body && (
          <div>
            <Text size="xsmall" className="text-ui-fg-muted">Response Body</Text>
            <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-32">
              {formatJson(log.response_body)}
            </pre>
          </div>
        )}
      </div>

      {/* Request */}
      {log.request_body && (
        <div>
          <Text size="small" weight="plus" className="mb-2">Request Payload</Text>
          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-32">
            {formatJson(log.request_body)}
          </pre>
        </div>
      )}

      {/* Details */}
      <div>
        <Text size="small" weight="plus" className="mb-2">Details</Text>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-ui-bg-subtle rounded">
            <Text size="xsmall" className="text-ui-fg-muted">Event ID</Text>
            <div className="flex items-center gap-1">
              <Text size="xsmall" className="font-mono truncate">{log.id}</Text>
              <Copy content={log.id} />
            </div>
          </div>
          <div className="p-2 bg-ui-bg-subtle rounded">
            <Text size="xsmall" className="text-ui-fg-muted">Triggered At</Text>
            <Text size="xsmall">{formatDate(log.triggered_at)}</Text>
          </div>
        </div>
      </div>
    </div>
  )
}

