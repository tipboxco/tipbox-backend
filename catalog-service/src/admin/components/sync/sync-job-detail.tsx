import { Heading, Text, Badge, Button, Copy, clx } from "@medusajs/ui"
import { CheckCircleSolid, XCircleSolid, Clock, Spinner, XMark } from "@medusajs/icons"

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

type SyncJob = {
  id: string
  status: JobStatus
  total_records: number
  processed_records: number
  failed_records: number
  current_batch: number
  total_batches: number
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  created_at: string
}

type SyncJobDetailProps = {
  job: SyncJob
  batchSize: number
  targetUrl: string
  onCancel?: () => void
  cancelling?: boolean
}

const statusConfig: Record<JobStatus, { 
  label: string
  Icon: React.ComponentType<{ className?: string }>
  bgColor: string
  textColor: string
  progressColor: string
}> = {
  pending: { label: "Bekliyor", Icon: Clock, bgColor: "bg-gray-50", textColor: "text-gray-700", progressColor: "bg-gray-400" },
  running: { label: "Çalışıyor", Icon: Spinner, bgColor: "bg-blue-50", textColor: "text-blue-700", progressColor: "bg-blue-500" },
  completed: { label: "Tamamlandı", Icon: CheckCircleSolid, bgColor: "bg-emerald-50", textColor: "text-emerald-700", progressColor: "bg-emerald-500" },
  failed: { label: "Başarısız", Icon: XCircleSolid, bgColor: "bg-red-50", textColor: "text-red-700", progressColor: "bg-red-500" },
  cancelled: { label: "İptal Edildi", Icon: XMark, bgColor: "bg-amber-50", textColor: "text-amber-700", progressColor: "bg-amber-500" },
}

export const SyncJobDetail = ({ job, batchSize, targetUrl, onCancel, cancelling }: SyncJobDetailProps) => {
  const config = statusConfig[job.status] || statusConfig.pending
  const progress = job.total_records > 0 ? Math.round((job.processed_records / job.total_records) * 100) : 0

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return "-"
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date()
    const diff = endDate.getTime() - startDate.getTime()
    if (diff < 1000) return `${diff}ms`
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`
    return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={clx("w-8 h-8 rounded-lg flex items-center justify-center", config.bgColor)}>
            <config.Icon className={clx("h-4 w-4", config.textColor, job.status === "running" && "animate-spin")} />
          </div>
          <div>
            <Heading level="h2" className="text-base">Sync Job</Heading>
            <Text size="xsmall" className="text-ui-fg-muted font-mono">{job.id}</Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(job.status === "pending" || job.status === "running") && onCancel && (
            <Button variant="danger" size="small" onClick={onCancel} disabled={cancelling}>
              <XMark className="h-3.5 w-3.5 mr-1" />
              {cancelling ? "İptal ediliyor..." : "İptal Et"}
            </Button>
          )}
          <Badge color={
            job.status === "completed" ? "green" :
            job.status === "failed" ? "red" :
            job.status === "running" ? "blue" :
            job.status === "cancelled" ? "orange" : "grey"
          } size="small">
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <div className={clx("rounded-lg border overflow-hidden", config.bgColor)}>
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <config.Icon className={clx("h-4 w-4", config.textColor, job.status === "running" && "animate-spin")} />
              <Text size="small" weight="plus" className={config.textColor}>
                {job.status === "running" ? "Senkronizasyon devam ediyor..." :
                 job.status === "completed" ? "Tamamlandı" :
                 job.status === "failed" ? "Başarısız" :
                 job.status === "cancelled" ? "Kullanıcı tarafından iptal edildi" : "Başlamayı bekliyor"}
              </Text>
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              {formatDuration(job.started_at, job.completed_at)}
            </Text>
          </div>
          
          <div className="w-full h-2.5 bg-white/50 rounded-full overflow-hidden mb-1">
            <div className={clx("h-full rounded-full transition-all", config.progressColor)} style={{ width: `${progress}%` }} />
          </div>
          
          <div className="flex justify-between">
            <Text size="xsmall" className="text-ui-fg-muted">Batch {job.current_batch} / {job.total_batches}</Text>
            <Text size="xsmall" weight="plus">{progress}%</Text>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x border-t">
          <div className="p-3 text-center">
            <Text size="large" weight="plus" className="text-emerald-600">{job.processed_records.toLocaleString()}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">İşlendi</Text>
          </div>
          <div className="p-3 text-center">
            <Text size="large" weight="plus" className="text-red-600">{job.failed_records.toLocaleString()}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">Hata</Text>
          </div>
          <div className="p-3 text-center">
            <Text size="large" weight="plus">{job.total_records.toLocaleString()}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">Toplam</Text>
          </div>
        </div>

        {job.error_message && (
          <div className="px-3 py-2 border-t bg-red-50">
            <div className="flex items-start gap-2">
              <XCircleSolid className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <Text size="small" weight="plus" className="text-red-700">Hata</Text>
                <Text size="xsmall" className="text-red-600 font-mono">{job.error_message}</Text>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">Job ID</Text>
          <div className="flex items-center gap-1">
            <Text size="xsmall" className="font-mono truncate">{job.id}</Text>
            <Copy content={job.id} />
          </div>
        </div>
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">Batch Size</Text>
          <Text size="xsmall" weight="plus">{batchSize.toLocaleString()}</Text>
        </div>
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">Başladı</Text>
          <Text size="xsmall">{formatDate(job.started_at)}</Text>
        </div>
        <div className="p-2 bg-ui-bg-subtle rounded">
          <Text size="xsmall" className="text-ui-fg-muted">Bitti</Text>
          <Text size="xsmall">{formatDate(job.completed_at)}</Text>
        </div>
        <div className="p-2 bg-ui-bg-subtle rounded col-span-2">
          <Text size="xsmall" className="text-ui-fg-muted">Target URL</Text>
          <div className="flex items-center gap-1">
            <Text size="xsmall" className="font-mono truncate">{targetUrl}</Text>
            <Copy content={targetUrl} />
          </div>
        </div>
      </div>
    </div>
  )
}

