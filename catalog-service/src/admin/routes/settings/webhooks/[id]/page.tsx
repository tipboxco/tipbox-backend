import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
  Container, 
  Heading, 
  Button, 
  Text, 
  toast,
  Badge,
  IconButton,
  DropdownMenu,
  Copy,
  clx,
} from "@medusajs/ui"
import { 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  ArrowLeft,
  PlaySolid,
  CheckCircleSolid,
  XCircleSolid,
  Clock,
  Spinner,
  ArrowPath,
  ExclamationCircle,
  CheckMini,
  XMark,
} from "@medusajs/icons"
import { Modal, ModalBody, ModalFooter } from "../../../../components/modal"
import { WebhookForm, WebhookLogItem, WebhookLogDetail } from "../../../../components/webhooks"
import { StatsCard, FilterTabs, SplitView } from "../../../../components/shared"

type Webhook = {
  id: string
  event_names: string[]
  target_url: string
  secret_token?: string | null
  is_active: boolean
  metadata?: Record<string, unknown> | null
  created_at?: string
}

type WebhookLog = {
  id: string
  webhook_id: string
  event_name: string
  target_url: string
  status: "success" | "failed" | "pending"
  status_code?: number | null
  request_body?: Record<string, unknown> | null
  response_body?: string | null
  error_message?: string | null
  duration_ms?: number | null
  triggered_at: string
  created_at: string
}

type WebhookStats = {
  total_requests: number
  successful: number
  failed: number
  success_rate: number
  avg_response_time_ms: number
}

type EventInfo = { name: string; description: string; category: string }

const WebhookDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [webhook, setWebhook] = useState<Webhook | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null)
  const [logFilter, setLogFilter] = useState<"all" | "succeeded" | "failed">("all")
  const [stats, setStats] = useState<WebhookStats | null>(null)
  
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [events, setEvents] = useState<EventInfo[]>([])
  const [testing, setTesting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resending, setResending] = useState<string | null>(null)

  const fetchEvents = async () => {
    try {
      const response = await fetch("/admin/webhooks/events", { credentials: "include" })
      const data = await response.json()
      setEvents(data.events || [])
    } catch {}
  }

  const fetchWebhook = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await fetch(`/admin/webhooks/${id}`, { credentials: "include" })
      if (!response.ok) { navigate("/settings/webhooks"); return }
      const data = await response.json()
      setWebhook(data.webhook)
    } catch { toast.error("Hata", { description: "Webhook yüklenirken hata oluştu" }) }
    finally { setLoading(false) }
  }, [id, navigate])

  const fetchLogs = useCallback(async () => {
    if (!id) return
    setLogsLoading(true)
    try {
      const response = await fetch(`/admin/webhooks/${id}/logs?limit=100`, { credentials: "include" })
      const data = await response.json()
      setLogs(data.logs || [])
      if (data.logs?.length > 0 && !selectedLog) setSelectedLog(data.logs[0])
    } catch {}
    finally { setLogsLoading(false) }
  }, [id])

  const fetchStats = useCallback(async () => {
    if (!id) return
    try {
      const response = await fetch(`/admin/webhooks/${id}/stats`, { credentials: "include" })
      const data = await response.json()
      setStats(data.stats)
    } catch {}
  }, [id])

  useEffect(() => { fetchEvents(); fetchWebhook(); fetchLogs(); fetchStats() }, [fetchWebhook, fetchLogs, fetchStats])

  const handleUpdateWebhook = async (data: { event_names: string[]; target_url: string; secret_token: string; is_active: boolean; metadata: string }) => {
    if (!id || data.event_names.length === 0 || !data.target_url.trim()) return
    try { new URL(data.target_url) } catch { toast.error("Hata", { description: "Geçersiz URL" }); return }
    
    let parsedMetadata = null
    if (data.metadata.trim()) { try { parsedMetadata = JSON.parse(data.metadata) } catch { toast.error("Hata", { description: "Geçersiz JSON" }); return } }

    setSaving(true)
    try {
      const response = await fetch(`/admin/webhooks/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_names: data.event_names, target_url: data.target_url, secret_token: data.secret_token || null, is_active: data.is_active, metadata: parsedMetadata }),
      })
      if (response.ok) { const d = await response.json(); setWebhook(d.webhook); toast.success("Başarılı", { description: "Webhook güncellendi" }); setEditDrawerOpen(false) }
      else { const error = await response.json(); toast.error("Hata", { description: error.error || "Güncellenemedi" }) }
    } catch { toast.error("Hata", { description: "Güncelleme hatası" }) }
    finally { setSaving(false) }
  }

  const handleToggle = async () => {
    if (!webhook || !id) return
    try {
      const response = await fetch(`/admin/webhooks/${id}/toggle`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !webhook.is_active }) })
      if (response.ok) { const d = await response.json(); setWebhook(d.webhook); toast.success("Başarılı", { description: `Webhook ${!webhook.is_active ? "aktif" : "pasif"} edildi` }) }
    } catch {}
  }

  const handleDeleteWebhook = async () => {
    if (!id) return
    setDeleting(true)
    try {
      const response = await fetch(`/admin/webhooks/${id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) { toast.success("Başarılı", { description: "Webhook silindi" }); navigate("/settings/webhooks") }
    } catch {}
    finally { setDeleting(false); setDeleteDialogOpen(false) }
  }

  const handleTest = async () => {
    if (!id) return
    setTesting(true)
    try {
      const response = await fetch(`/admin/webhooks/${id}/test`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (result.success) toast.success("Test Başarılı", { description: `HTTP ${result.status_code}` })
      else toast.error("Test Başarısız", { description: result.error })
      fetchLogs(); fetchStats()
    } catch { toast.error("Hata", { description: "Test gönderilemedi" }) }
    finally { setTesting(false) }
  }

  const handleResend = async (log: WebhookLog) => {
    if (!id || resending) return
    setResending(log.id)
    try {
      const response = await fetch(`/admin/webhooks/${id}/test`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (result.success) toast.success("Başarılı", { description: "İstek yeniden gönderildi" })
      else toast.error("Başarısız", { description: result.error })
      fetchLogs(); fetchStats()
    } catch {}
    finally { setResending(null) }
  }

  const formatDuration = (ms?: number | null) => { if (!ms) return "-"; if (ms < 1000) return `${ms}ms`; return `${(ms / 1000).toFixed(2)}s` }
  const formatTime = (d?: string) => { if (!d) return "-"; return new Date(d).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }
  const formatDate = (d?: string) => { if (!d) return "-"; return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }
  const formatJson = (data: unknown) => { try { if (typeof data === "string") return JSON.stringify(JSON.parse(data), null, 2); return JSON.stringify(data, null, 2) } catch { return String(data) } }
  const getSuccessRateColor = (rate: number) => rate >= 95 ? "success" : rate >= 80 ? "warning" : "danger"

  const filteredLogs = logs.filter(log => {
    if (logFilter === "succeeded") return log.status === "success"
    if (logFilter === "failed") return log.status === "failed"
    return true
  })

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.triggered_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {} as Record<string, WebhookLog[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Spinner className="animate-spin h-6 w-6 text-violet-600" />
      </div>
    )
  }

  if (!webhook) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <ExclamationCircle className="h-10 w-10 text-ui-fg-muted mx-auto mb-3" />
          <Heading level="h2" className="text-base mb-2">Webhook bulunamadı</Heading>
          <Button variant="secondary" size="small" onClick={() => navigate("/settings/webhooks")}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  const successCount = logs.filter(l => l.status === "success").length
  const failedCount = logs.filter(l => l.status === "failed").length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-ui-bg-subtle">
      {/* Header */}
      <div className="bg-white border-b border-ui-border-base">
        <div className="px-4 py-2 border-b border-ui-border-base flex items-center gap-3">
          <button onClick={() => navigate("/settings/webhooks")} className="flex items-center gap-1 text-ui-fg-muted hover:text-ui-fg-base text-sm">
            <ArrowLeft className="h-4 w-4" /><span>Webhooks</span>
          </button>
          <div className="h-4 w-px bg-ui-border-base" />
          <button onClick={handleToggle} className="flex items-center gap-1.5">
            <div className={clx("w-2 h-2 rounded-full", webhook.is_active ? "bg-emerald-500" : "bg-gray-400")} />
            <span className="text-xs text-ui-fg-muted">{webhook.is_active ? "Active" : "Disabled"}</span>
          </button>
        </div>
        
        <div className="px-4 py-3 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Text size="small" weight="plus" className="font-mono">{webhook.target_url}</Text>
                <Copy content={webhook.target_url} />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted font-mono">{webhook.id}</Text>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="small" onClick={handleTest} disabled={testing}>
              <PlaySolid className={clx("h-3 w-3 mr-1", testing && "animate-pulse")} />Test
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent" size="small"><EllipsisHorizontal className="h-4 w-4" /></IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => setEditDrawerOpen(true)}><PencilSquare className="mr-2 h-3.5 w-3.5" />Düzenle</DropdownMenu.Item>
                <DropdownMenu.Item onClick={handleToggle}>{webhook.is_active ? <><XCircleSolid className="mr-2 h-3.5 w-3.5" />Pasif Et</> : <><CheckCircleSolid className="mr-2 h-3.5 w-3.5" />Aktif Et</>}</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => setDeleteDialogOpen(true)} className="text-red-600"><Trash className="mr-2 h-3.5 w-3.5" />Sil</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Stats Bar */}
        {stats && (
          <div className="px-4 py-2.5 bg-ui-bg-subtle border-t border-ui-border-base">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Badge color="purple" size="xsmall">{webhook.event_names?.length || 0}</Badge>
                <Text size="xsmall" className="text-ui-fg-muted">events</Text>
              </div>
              <div className="h-4 w-px bg-ui-border-base" />
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">Total</Text>
                <Text size="small" weight="plus">{stats.total_requests}</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">Success</Text>
                <Text size="small" weight="plus" className={getSuccessRateColor(stats.success_rate) === "success" ? "text-emerald-600" : getSuccessRateColor(stats.success_rate) === "warning" ? "text-amber-600" : "text-red-600"}>{stats.success_rate}%</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">Latency</Text>
                <Text size="small" weight="plus">{formatDuration(stats.avg_response_time_ms)}</Text>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Split View */}
      <SplitView
        leftWidth="w-[360px]"
        leftPanel={
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-ui-border-base">
              <FilterTabs
                tabs={[
                  { id: "all", label: "All", count: logs.length },
                  { id: "succeeded", label: "OK", count: successCount, color: "green" },
                  { id: "failed", label: "Fail", count: failedCount, color: "red" },
                ]}
                activeTab={logFilter}
                onTabChange={(t) => setLogFilter(t as "all" | "succeeded" | "failed")}
              />
              <div className="flex-1" />
              <IconButton variant="transparent" size="small" onClick={() => { fetchLogs(); fetchStats() }} disabled={logsLoading}>
                <ArrowPath className={clx("h-3.5 w-3.5", logsLoading && "animate-spin")} />
              </IconButton>
            </div>
            
            {/* Log List */}
            <div className="flex-1 overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12"><Spinner className="animate-spin h-5 w-5 text-violet-600" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center px-4">
                  <Clock className="h-8 w-8 text-ui-fg-muted mb-2" />
                  <Text weight="plus" className="text-sm mb-1">Henüz log yok</Text>
                  <Text size="xsmall" className="text-ui-fg-muted mb-3">Test event gönderin veya gerçek event'leri bekleyin.</Text>
                  <Button variant="secondary" size="small" onClick={handleTest}><PlaySolid className="h-3 w-3 mr-1" />Test</Button>
                </div>
              ) : (
                Object.entries(groupedLogs).map(([date, dateLogs]) => (
                  <div key={date}>
                    <div className="px-3 py-1.5 bg-ui-bg-subtle border-b border-ui-border-base sticky top-0">
                      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase tracking-wider">{date}</Text>
                    </div>
                    {dateLogs.map((log) => (
                      <WebhookLogItem
                        key={log.id}
                        id={log.id}
                        eventName={log.event_name}
                        status={log.status}
                        statusCode={log.status_code}
                        durationMs={log.duration_ms}
                        errorMessage={log.error_message}
                        triggeredAt={log.triggered_at}
                        isSelected={selectedLog?.id === log.id}
                        onClick={() => setSelectedLog(log)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        }
        rightPanel={
          selectedLog ? (
            <div className="p-4">
              {/* Event Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={clx("w-8 h-8 rounded-lg flex items-center justify-center", selectedLog.status === "success" ? "bg-emerald-100" : "bg-red-100")}>
                    {selectedLog.status === "success" ? <CheckCircleSolid className="h-4 w-4 text-emerald-600" /> : <XCircleSolid className="h-4 w-4 text-red-600" />}
                  </div>
                  <div>
                    <Heading level="h2" className="text-base">{selectedLog.event_name}</Heading>
                    <Text size="xsmall" className="text-ui-fg-muted font-mono">{selectedLog.id}</Text>
                  </div>
                </div>
                <Button variant="secondary" size="small" onClick={() => handleResend(selectedLog)} disabled={resending === selectedLog.id}>
                  <ArrowPath className={clx("h-3 w-3 mr-1", resending === selectedLog.id && "animate-spin")} />Resend
                </Button>
              </div>
              
              {/* Response */}
              <div className={clx("rounded-lg border overflow-hidden mb-4", selectedLog.status === "success" ? "border-emerald-200" : "border-red-200")}>
                <div className={clx("flex items-center justify-between px-3 py-2", selectedLog.status === "success" ? "bg-emerald-50" : "bg-red-50")}>
                  <div className="flex items-center gap-2">
                    {selectedLog.status === "success" ? <CheckCircleSolid className="h-4 w-4 text-emerald-600" /> : <XCircleSolid className="h-4 w-4 text-red-600" />}
                    <div>
                      <Text size="small" weight="plus" className={selectedLog.status === "success" ? "text-emerald-700" : "text-red-700"}>
                        {selectedLog.status_code ? `HTTP ${selectedLog.status_code}` : "Error"}
                      </Text>
                      {selectedLog.error_message && <Text size="xsmall" className="text-red-600">{selectedLog.error_message}</Text>}
                    </div>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted">{formatDuration(selectedLog.duration_ms)}</Text>
                </div>
                
                {selectedLog.response_body && (
                  <div className="border-t border-ui-border-base">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-ui-bg-subtle border-b border-ui-border-base">
                      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">Response</Text>
                      <Copy content={selectedLog.response_body} />
                    </div>
                    <pre className="bg-slate-900 text-slate-300 p-3 text-xs font-mono overflow-auto max-h-28">{formatJson(selectedLog.response_body)}</pre>
                  </div>
                )}
              </div>
              
              {/* Request */}
              {selectedLog.request_body && (
                <div className="rounded-lg border border-ui-border-base overflow-hidden mb-4">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-ui-bg-subtle border-b border-ui-border-base">
                    <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">Request</Text>
                    <Copy content={formatJson(selectedLog.request_body)} />
                  </div>
                  <pre className="bg-slate-900 text-slate-300 p-3 text-xs font-mono overflow-auto max-h-40">{formatJson(selectedLog.request_body)}</pre>
                </div>
              )}
              
              {/* Details */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-ui-bg-subtle rounded">
                  <Text size="xsmall" className="text-ui-fg-muted">Event ID</Text>
                  <div className="flex items-center gap-1"><Text size="xsmall" className="font-mono truncate">{selectedLog.id}</Text><Copy content={selectedLog.id} /></div>
                </div>
                <div className="p-2.5 bg-ui-bg-subtle rounded">
                  <Text size="xsmall" className="text-ui-fg-muted">Triggered At</Text>
                  <Text size="xsmall">{formatDate(selectedLog.triggered_at)}</Text>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-14 h-14 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-ui-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <Heading level="h3" className="text-sm mb-1">Bir event seçin</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">Detayları görüntülemek için listeden bir event seçin.</Text>
            </div>
          )
        }
      />

      {/* Edit Drawer */}
      <WebhookForm
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        initialData={{
          event_names: webhook.event_names || [],
          target_url: webhook.target_url,
          secret_token: webhook.secret_token || "",
          is_active: webhook.is_active,
          metadata: webhook.metadata ? JSON.stringify(webhook.metadata, null, 2) : "",
        }}
        events={events}
        onSave={handleUpdateWebhook}
        isEditing={true}
        saving={saving}
      />

      {/* Delete Modal */}
      <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Webhook'u Sil" size="sm">
        <ModalBody>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <Text className="text-ui-fg-base text-sm">Bu webhook'u silmek istediğinize emin misiniz?</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">Bu işlem geri alınamaz.</Text>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="small" onClick={() => setDeleteDialogOpen(false)}>İptal</Button>
            <Button variant="danger" size="small" onClick={handleDeleteWebhook} disabled={deleting}>{deleting ? "Siliniyor..." : "Sil"}</Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default WebhookDetailPage
