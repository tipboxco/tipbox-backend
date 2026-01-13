import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
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
  ArrowLeft,
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  PlaySolid,
  CheckCircleSolid,
  XCircleSolid,
  ArrowPath,
  Clock,
  Spinner,
  ExclamationCircle,
  CheckMini,
  XMark,
} from "@medusajs/icons"
import { Modal, ModalBody, ModalFooter } from "../../../../components/modal"
import { SyncForm, SyncJobItem, SyncJobDetail } from "../../../../components/sync"
import { FilterTabs, SplitView } from "../../../../components/shared"

type ModuleType = "product" | "category" | "brand"
type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

type SyncStats = { total_jobs: number; success_rate: number; total_records_synced: number }

type SyncJob = {
  id: string
  sync_config_id: string
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

type SyncConfig = {
  id: string
  name: string
  module_type: ModuleType
  target_url: string
  secret_token?: string | null
  batch_size: number
  is_active: boolean
  last_sync_at?: string | null
}

const MODULE_LABELS: Record<ModuleType, string> = { product: "Ürünler", category: "Kategoriler", brand: "Markalar" }

const SyncDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [config, setConfig] = useState<SyncConfig | null>(null)
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [jobFilter, setJobFilter] = useState<"all" | "completed" | "failed">("all")
  
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cancellingJob, setCancellingJob] = useState<string | null>(null)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const fetchInitialData = useCallback(async () => {
    if (!id) return
    try {
      const response = await fetch(`/admin/sync/${id}`, { credentials: "include" })
      if (!response.ok) { navigate("/settings/sync"); return }
      const data = await response.json()
      setConfig(data.sync_config)
      setStats(data.stats)
      setJobs(data.recent_jobs || [])
      if (data.recent_jobs?.length > 0) setSelectedJob(data.recent_jobs[0])
    } catch {}
    finally { setLoading(false) }
  }, [id, navigate])

  const connectSSE = useCallback(() => {
    if (!id || eventSourceRef.current) return
    
    const eventSource = new EventSource(`/admin/sync/${id}/stream`, { withCredentials: true })
    eventSourceRef.current = eventSource
    setIsStreaming(true)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.sync_config) setConfig(data.sync_config)
        if (data.stats) setStats(data.stats)
        if (data.jobs) {
          setJobs(data.jobs)
          setSelectedJob(prev => {
            if (!prev) return data.jobs.length > 0 ? data.jobs[0] : null
            return data.jobs.find((j: SyncJob) => j.id === prev.id) || prev
          })
        }
        setLoading(false)
      } catch {}
    }
    
    eventSource.onerror = () => {
      setIsStreaming(false)
      eventSource.close()
      eventSourceRef.current = null
      setTimeout(() => { if (id) connectSSE() }, 5000)
    }
  }, [id])

  useEffect(() => {
    fetchInitialData()
    connectSSE()
    return () => { if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null } }
  }, [fetchInitialData, connectSSE])

  const handleSave = async (data: { name: string; module_type: ModuleType; target_url: string; secret_token: string; batch_size: number; is_active: boolean }) => {
    if (!id || !data.name.trim() || !data.target_url.trim()) return
    try { new URL(data.target_url) } catch { toast.error("Hata", { description: "Geçersiz URL" }); return }

    setSaving(true)
    try {
      const response = await fetch(`/admin/sync/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name.trim(), module_type: data.module_type, target_url: data.target_url.trim(), secret_token: data.secret_token || null, batch_size: data.batch_size, is_active: data.is_active }),
      })
      if (response.ok) { const d = await response.json(); setConfig(d.sync_config); toast.success("Başarılı", { description: "Güncellendi" }); setEditDrawerOpen(false) }
      else { const error = await response.json(); toast.error("Hata", { description: error.error }) }
    } catch { toast.error("Hata", { description: "Güncelleme hatası" }) }
    finally { setSaving(false) }
  }

  const handleRunSync = async () => {
    if (!id || running) return
    setRunning(true)
    try {
      const response = await fetch(`/admin/sync/${id}/run`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (response.ok) toast.success("Başlatıldı", { description: `${result.total_records} kayıt, ${result.total_batches} batch` })
      else toast.error("Hata", { description: result.error })
    } catch { toast.error("Hata", { description: "Başlatılamadı" }) }
    finally { setRunning(false) }
  }

  const handleCancelJob = async (job: SyncJob) => {
    if (cancellingJob) return
    setCancellingJob(job.id)
    try {
      const response = await fetch(`/admin/sync/jobs/${job.id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) toast.success("Başarılı", { description: "Job iptal edildi" })
      else { const error = await response.json(); toast.error("Hata", { description: error.error }) }
    } catch { toast.error("Hata", { description: "İptal edilemedi" }) }
    finally { setCancellingJob(null) }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      const response = await fetch(`/admin/sync/${id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) { toast.success("Başarılı", { description: "Silindi" }); navigate("/settings/sync") }
    } catch {}
    finally { setDeleting(false); setDeleteDialogOpen(false) }
  }

  const handleToggleActive = async () => {
    if (!id || !config) return
    try {
      const response = await fetch(`/admin/sync/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !config.is_active }) })
      if (response.ok) { const d = await response.json(); setConfig(d.sync_config); toast.success("Başarılı", { description: config.is_active ? "Devre dışı" : "Aktif" }) }
    } catch {}
  }

  const formatDate = (d?: string | null) => { if (!d) return "-"; return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }
  const formatTime = (d?: string | null) => { if (!d) return "-"; return new Date(d).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }

  const filteredJobs = jobs.filter(job => {
    if (jobFilter === "completed") return job.status === "completed"
    if (jobFilter === "failed") return job.status === "failed"
    return true
  })

  const groupedJobs = filteredJobs.reduce((acc, job) => {
    const date = new Date(job.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    if (!acc[date]) acc[date] = []
    acc[date].push(job)
    return acc
  }, {} as Record<string, SyncJob[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Spinner className="animate-spin h-6 w-6 text-cyan-600" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <ExclamationCircle className="h-10 w-10 text-ui-fg-muted mx-auto mb-3" />
          <Heading level="h2" className="text-base mb-2">Sync bulunamadı</Heading>
          <Button variant="secondary" size="small" onClick={() => navigate("/settings/sync")}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  const hasRunningJob = jobs.some(j => j.status === "running" || j.status === "pending")
  const completedCount = jobs.filter(j => j.status === "completed").length
  const failedCount = jobs.filter(j => j.status === "failed").length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-ui-bg-subtle">
      {/* Header */}
      <div className="bg-white border-b border-ui-border-base">
        <div className="px-4 py-2 border-b border-ui-border-base flex items-center gap-3">
          <button onClick={() => navigate("/settings/sync")} className="flex items-center gap-1 text-ui-fg-muted hover:text-ui-fg-base text-sm">
            <ArrowLeft className="h-4 w-4" /><span>Data Sync</span>
          </button>
          <div className="h-4 w-px bg-ui-border-base" />
          <button onClick={handleToggleActive} className="flex items-center gap-1.5">
            <div className={clx("w-2 h-2 rounded-full", config.is_active ? "bg-emerald-500" : "bg-gray-400")} />
            <span className="text-xs text-ui-fg-muted">{config.is_active ? "Active" : "Disabled"}</span>
          </button>
          <div className="h-4 w-px bg-ui-border-base" />
          <div className="flex items-center gap-1">
            <span className={clx("h-1.5 w-1.5 rounded-full", isStreaming ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
            <span className="text-xs text-ui-fg-muted">{isStreaming ? "Canlı" : "..."}</span>
          </div>
        </div>
        
        <div className="px-4 py-3 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <div>
              <Text size="small" weight="plus">{config.name}</Text>
              <div className="flex items-center gap-1.5">
                <Badge color={config.module_type === "product" ? "blue" : config.module_type === "category" ? "green" : "purple"} size="xsmall">{MODULE_LABELS[config.module_type]}</Badge>
                <Text size="xsmall" className="text-ui-fg-muted font-mono">{config.target_url}</Text>
                <Copy content={config.target_url} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="small" onClick={handleRunSync} disabled={!config.is_active || running || hasRunningJob}>
              {running || hasRunningJob ? <><Spinner className="animate-spin h-3 w-3 mr-1" />Çalışıyor</> : <><PlaySolid className="h-3 w-3 mr-1" />Başlat</>}
            </Button>
            <Button variant="secondary" size="small" onClick={() => setEditDrawerOpen(true)}><PencilSquare className="h-3 w-3 mr-1" />Düzenle</Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild><IconButton variant="transparent" size="small"><EllipsisHorizontal className="h-4 w-4" /></IconButton></DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={handleToggleActive}>{config.is_active ? <><XCircleSolid className="mr-2 h-3.5 w-3.5" />Pasif Et</> : <><CheckCircleSolid className="mr-2 h-3.5 w-3.5" />Aktif Et</>}</DropdownMenu.Item>
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
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">Jobs</Text>
                <Text size="small" weight="plus">{stats.total_jobs}</Text>
              </div>
              <div>
                <Text size="xsmall" className="text-ui-fg-muted">Success</Text>
                <Text size="small" weight="plus" className={clx(stats.success_rate >= 80 ? "text-emerald-600" : stats.success_rate >= 50 ? "text-amber-600" : "text-red-600")}>{stats.success_rate}%</Text>
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
                <Text size="xsmall">{formatDate(config.last_sync_at) || "Never"}</Text>
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
            <div className="flex items-center gap-1 px-3 py-2 border-b border-ui-border-base">
              <FilterTabs
                tabs={[
                  { id: "all", label: "All", count: jobs.length },
                  { id: "completed", label: "OK", count: completedCount, color: "green" },
                  { id: "failed", label: "Fail", count: failedCount, color: "red" },
                ]}
                activeTab={jobFilter}
                onTabChange={(t) => setJobFilter(t as "all" | "completed" | "failed")}
              />
              <div className="flex-1" />
              <IconButton variant="transparent" size="small" onClick={fetchInitialData}><ArrowPath className="h-3.5 w-3.5" /></IconButton>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredJobs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center px-4">
                  <Clock className="h-8 w-8 text-ui-fg-muted mb-2" />
                  <Text weight="plus" className="text-sm mb-1">Henüz job yok</Text>
                  <Text size="xsmall" className="text-ui-fg-muted mb-3">Sync başlatın</Text>
                  <Button variant="secondary" size="small" onClick={handleRunSync}><PlaySolid className="h-3 w-3 mr-1" />Başlat</Button>
                </div>
              ) : (
                Object.entries(groupedJobs).map(([date, dateJobs]) => (
                  <div key={date}>
                    <div className="px-3 py-1.5 bg-ui-bg-subtle border-b border-ui-border-base sticky top-0">
                      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase tracking-wider">{date}</Text>
                    </div>
                    {dateJobs.map((job) => (
                      <SyncJobItem
                        key={job.id}
                        id={job.id}
                        status={job.status}
                        currentBatch={job.current_batch}
                        totalBatches={job.total_batches}
                        processedRecords={job.processed_records}
                        totalRecords={job.total_records}
                        startedAt={job.started_at}
                        createdAt={job.created_at}
                        isSelected={selectedJob?.id === job.id}
                        onClick={() => setSelectedJob(job)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        }
        rightPanel={
          selectedJob ? (
            <SyncJobDetail
              job={selectedJob}
              batchSize={config.batch_size}
              targetUrl={config.target_url}
              onCancel={() => handleCancelJob(selectedJob)}
              cancelling={cancellingJob === selectedJob.id}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-14 h-14 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-ui-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <Heading level="h3" className="text-sm mb-1">Bir job seçin</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">Detayları görüntülemek için listeden bir job seçin.</Text>
            </div>
          )
        }
      />

      {/* Edit Drawer */}
      <SyncForm
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        initialData={{
          name: config.name,
          module_type: config.module_type,
          target_url: config.target_url,
          secret_token: config.secret_token || "",
          batch_size: config.batch_size,
          is_active: config.is_active,
        }}
        onSave={handleSave}
        isEditing={true}
        saving={saving}
      />

      {/* Delete Modal */}
      <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Sync Sil" size="sm">
        <ModalBody>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <Text className="text-ui-fg-base text-sm">Bu sync'i silmek istediğinize emin misiniz?</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">Bu işlem geri alınamaz.</Text>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="small" onClick={() => setDeleteDialogOpen(false)}>İptal</Button>
            <Button variant="danger" size="small" onClick={handleDelete} disabled={deleting}>{deleting ? "Siliniyor..." : "Sil"}</Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default SyncDetailPage
