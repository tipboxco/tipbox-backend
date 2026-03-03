import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "@medusajs/ui"
import { backendUrl } from "../../lib/config"
import type { SyncConfig, SyncJob, SyncStats, LogLine } from "./types"
import type { SyncFormData } from "./sync-form"

type JobFilter = "all" | "completed" | "failed"

type SyncDetailState = {
  config: SyncConfig | null
  stats: SyncStats | null
  jobs: SyncJob[]
  selectedJob: SyncJob | null
  loading: boolean
  running: boolean
  jobFilter: JobFilter
  editDrawerOpen: boolean
  saving: boolean
  deleteDialogOpen: boolean
  deleting: boolean
  cancellingJob: string | null
  isStreaming: boolean
  streamLogOpen: boolean
  streamLogLines: LogLine[]
  streamJobId: string | null
}

type SyncDetailActions = {
  setSelectedJob: (job: SyncJob | null) => void
  setJobFilter: (filter: JobFilter) => void
  setEditDrawerOpen: (open: boolean) => void
  setDeleteDialogOpen: (open: boolean) => void
  setStreamLogOpen: (open: boolean) => void
  fetchInitialData: () => Promise<void>
  handleSave: (data: SyncFormData) => Promise<void>
  handleRunSync: () => Promise<void>
  handleCancelJob: (job: SyncJob) => Promise<void>
  handleDelete: () => Promise<void>
  handleToggleActive: () => Promise<void>
}

type SyncDetailContextValue = SyncDetailState & SyncDetailActions

const SyncDetailContext = createContext<SyncDetailContextValue | null>(null)

export function useSyncDetail() {
  const ctx = useContext(SyncDetailContext)
  if (!ctx) throw new Error("useSyncDetail must be used within SyncDetailProvider")
  return ctx
}

type SyncDetailProviderProps = {
  configId: string | undefined
  children: ReactNode
}

export function SyncDetailProvider({ configId, children }: SyncDetailProviderProps) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<SyncConfig | null>(null)
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [jobFilter, setJobFilter] = useState<JobFilter>("all")
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cancellingJob, setCancellingJob] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamLogOpen, setStreamLogOpen] = useState(false)
  const [streamLogLines, setStreamLogLines] = useState<LogLine[]>([])
  const [streamJobId, setStreamJobId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const editDrawerOpenRef = useRef(editDrawerOpen)
  const jobsRef = useRef<SyncJob[]>(jobs)
  editDrawerOpenRef.current = editDrawerOpen
  jobsRef.current = jobs

  const fetchInitialData = useCallback(async () => {
    if (!configId) return
    try {
      const response = await fetch(`${backendUrl}/admin/sync/${configId}`, { credentials: "include" })
      if (!response.ok) {
        navigate("/settings/sync")
        return
      }
      const data = await response.json()
      setConfig(data.sync_config)
      setStats(data.stats)
      const newJobs = data.recent_jobs || []
      setJobs(newJobs)
      setSelectedJob((prev) => {
        if (!prev) return newJobs.length > 0 ? newJobs[0] : null
        const found = newJobs.find((j: SyncJob) => j.id === prev.id)
        return found ?? prev
      })
    } catch {}
    finally {
      setLoading(false)
    }
  }, [configId, navigate])

  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const SSE_CONNECT_TIMEOUT_MS = 8000

  /** SSE bağlantısını kurar; zaten bağlıysa hemen resolve. Yoksa onopen veya ilk mesajda resolve (timeout ile). */
  const connectSSE = useCallback((): Promise<void> => {
    if (!configId) return Promise.resolve()
    if (eventSourceRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      let resolved = false
      const done = () => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, SSE_CONNECT_TIMEOUT_MS)

      const eventSource = new EventSource(`${backendUrl}/admin/sync/${configId}/stream`, { withCredentials: true })
      eventSourceRef.current = eventSource
      setIsStreaming(true)
      eventSource.onopen = () => done()
      eventSource.onmessage = (event) => {
        if (!resolved) done()
        try {
          const data = JSON.parse(event.data)
          if (data.type === "stream_end") {
            disconnectSSE()
            return
          }
          if (data.sync_config && !editDrawerOpenRef.current) setConfig(data.sync_config)
          if (data.stats) setStats(data.stats)
          if (data.jobs) {
            const newJobs = data.jobs as SyncJob[]
            const hadRunning = jobsRef.current.some((j) => j.status === "running" || j.status === "pending")
            const nowNoneRunning = newJobs.every((j: SyncJob) => j.status !== "running" && j.status !== "pending")
            if (hadRunning && nowNoneRunning) disconnectSSE()
            setJobs(newJobs)
            setSelectedJob((prev) => {
              if (!prev) return newJobs.length > 0 ? newJobs[0] : null
              const found = newJobs.find((j: SyncJob) => j.id === prev.id)
              return found ?? prev
            })
          }
          setLoading(false)
        } catch {}
      }
      eventSource.onerror = () => {
        setIsStreaming(false)
        eventSource.close()
        eventSourceRef.current = null
        if (!resolved) done()
        setTimeout(() => { if (configId) connectSSE() }, 5000)
      }
    })
  }, [configId, disconnectSSE])

  useEffect(() => {
    fetchInitialData()
    connectSSE()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchInitialData, connectSSE])

  const handleSave = useCallback(async (data: SyncFormData) => {
    if (!configId || !data.name.trim() || !data.target_url.trim()) return
    try {
      new URL(data.target_url)
    } catch {
      toast.error("Hata", { description: "Geçersiz URL" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`${backendUrl}/admin/sync/${configId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          module_type: data.module_type,
          target_url: data.target_url.trim(),
          secret_token: data.secret_token || null,
          batch_size: data.batch_size,
          is_active: data.is_active,
        }),
      })
      if (response.ok) {
        const d = await response.json()
        setConfig(d.sync_config)
        toast.success("Başarılı", { description: "Güncellendi" })
        setEditDrawerOpen(false)
      } else {
        const error = await response.json()
        toast.error("Hata", { description: error.error })
      }
    } catch {
      toast.error("Hata", { description: "Güncelleme hatası" })
    } finally {
      setSaving(false)
    }
  }, [configId])

  const handleRunSync = useCallback(async () => {
    if (!configId || running || !config) return
    setRunning(true)
    const isBackendSeed = config.module_type === "backend_seed"
    if (isBackendSeed) {
      setStreamLogLines([])
      setStreamJobId(null)
    }
    await connectSSE()
    try {
      const response = await fetch(`${backendUrl}/admin/sync/${configId}/run`, { method: "POST", credentials: "include" })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        toast.error("Hata", { description: (result as { error?: string }).error || response.statusText })
        return
      }
      const contentType = response.headers.get("content-type") ?? ""
      const isStream = contentType.includes("ndjson") && response.body != null

      if (isStream && response.body) {
        const newJobId = response.headers.get("X-Seed-Job-Id") ?? null
        setStreamJobId(newJobId)
        if (newJobId) {
          setSelectedJob({
            id: newJobId,
            status: "running",
            total_records: 0,
            processed_records: 0,
            failed_records: 0,
            current_batch: 0,
            total_batches: 1,
            created_at: new Date().toISOString(),
          })
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          const batch: LogLine[] = []
          for (const raw of lines) {
            if (!raw.trim()) continue
            try {
              const data = JSON.parse(raw) as { type: string; job_id?: string; line?: string; status?: string }
              if (data.type === "job" && data.job_id) {
                setStreamJobId(data.job_id)
                setSelectedJob({
                  id: data.job_id,
                  status: "running",
                  total_records: 0,
                  processed_records: 0,
                  failed_records: 0,
                  current_batch: 0,
                  total_batches: 1,
                  created_at: new Date().toISOString(),
                })
                continue
              }
              if (data.type === "job_complete" && data.job_id) {
                toast.success("Tamamlandı", { description: `${config.name} sync tamamlandı` })
                disconnectSSE()
                fetchInitialData()
                continue
              }
              if (data.type === "stdout" || data.type === "stderr") {
                batch.push({ type: data.type as "stdout" | "stderr", line: data.line ?? "" })
              }
            } catch {
              batch.push({ type: "stdout", line: raw })
            }
          }
          if (batch.length > 0) {
            setStreamLogLines((prev) => [...prev, ...batch])
            await new Promise<void>((r) => requestAnimationFrame(() => r()))
          }
        }
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer) as { type: string; line?: string }
            if (data.type === "stdout" || data.type === "stderr") {
              setStreamLogLines((prev) => [...prev, { type: data.type as "stdout" | "stderr", line: data.line ?? buffer }])
            }
          } catch {
            setStreamLogLines((prev) => [...prev, { type: "stdout", line: buffer }])
          }
        }
      } else {
        const result = await response.json() as { job_id?: string; total_records?: number; total_batches?: number; error?: string }
        if (response.ok && result.job_id) {
          toast.success("Başlatıldı", { description: `${result.total_records ?? 0} kayıt, ${result.total_batches ?? 0} batch` })
          setSelectedJob({
            id: result.job_id,
            status: "running",
            total_records: result.total_records ?? 0,
            processed_records: 0,
            failed_records: 0,
            current_batch: 0,
            total_batches: result.total_batches ?? 0,
            created_at: new Date().toISOString(),
          })
          fetchInitialData()
        } else {
          toast.error("Hata", { description: result.error ?? "Başlatılamadı" })
        }
      }
    } catch {
      toast.error("Hata", { description: "Başlatılamadı" })
    } finally {
      setRunning(false)
    }
  }, [configId, running, config, fetchInitialData, disconnectSSE, connectSSE])

  const handleCancelJob = useCallback(async (job: SyncJob) => {
    if (cancellingJob) return
    setCancellingJob(job.id)
    try {
      const response = await fetch(`${backendUrl}/admin/sync/jobs/${job.id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) toast.success("Başarılı", { description: "Job iptal edildi" })
      else {
        const error = await response.json()
        toast.error("Hata", { description: error.error })
      }
    } catch {
      toast.error("Hata", { description: "İptal edilemedi" })
    } finally {
      setCancellingJob(null)
    }
  }, [cancellingJob])

  const handleDelete = useCallback(async () => {
    if (!configId) return
    setDeleting(true)
    try {
      const response = await fetch(`${backendUrl}/admin/sync/${configId}`, { method: "DELETE", credentials: "include" })
      if (response.ok) {
        toast.success("Başarılı", { description: "Silindi" })
        navigate("/settings/sync")
      }
    } catch {}
    finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }, [configId, navigate])

  const handleToggleActive = useCallback(async () => {
    if (!configId || !config) return
    try {
      const response = await fetch(`${backendUrl}/admin/sync/${configId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !config.is_active }),
      })
      if (response.ok) {
        const d = await response.json()
        setConfig(d.sync_config)
        toast.success("Başarılı", { description: config.is_active ? "Devre dışı" : "Aktif" })
      }
    } catch {}
  }, [configId, config])

  const value: SyncDetailContextValue = {
    config,
    stats,
    jobs,
    selectedJob,
    loading,
    running,
    jobFilter,
    editDrawerOpen,
    saving,
    deleteDialogOpen,
    deleting,
    cancellingJob,
    isStreaming,
    streamLogOpen,
    streamLogLines,
    streamJobId,
    setSelectedJob,
    setJobFilter,
    setEditDrawerOpen,
    setDeleteDialogOpen,
    setStreamLogOpen,
    fetchInitialData,
    handleSave,
    handleRunSync,
    handleCancelJob,
    handleDelete,
    handleToggleActive,
  }

  return (
    <SyncDetailContext.Provider value={value}>
      {children}
    </SyncDetailContext.Provider>
  )
}
