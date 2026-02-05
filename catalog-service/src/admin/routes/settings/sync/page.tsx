import { useEffect, useState, useCallback, useRef } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, toast } from "@medusajs/ui"
import { ArrowsPointingOut, PlusMini, Spinner } from "@medusajs/icons"
import {
  SyncForm,
  PageHeader,
  EmptyState,
  BulkActionBar,
  SyncConfigTable,
  BackendSeedSection,
  StreamLogDrawer,
  type SyncConfig,
  type ModuleType,
  type BackendSeedItem,
  type LogLine,
  type SyncFormData,
} from "../../../components/sync"

const SyncPage = () => {
  const [configs, setConfigs] = useState<SyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SyncConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [runningSyncs, setRunningSyncs] = useState<Set<string>>(new Set())
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set())

  const [backendSeeds, setBackendSeeds] = useState<BackendSeedItem[]>([])
  const [backendSeedLoading, setBackendSeedLoading] = useState(false)
  const [backendRunLoading, setBackendRunLoading] = useState(false)
  const [runningSeedId, setRunningSeedId] = useState<string | null>(null)
  const [addingSeedId, setAddingSeedId] = useState<string | null>(null)
  const [streamLogOpen, setStreamLogOpen] = useState(false)
  const [streamLogLines, setStreamLogLines] = useState<LogLine[]>([])
  const [streamSeedName, setStreamSeedName] = useState("")
  const [streamJobId, setStreamJobId] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  /** @param silent true ise loading gösterme, filtre/seçim state kaybolmasın */
  const fetchConfigs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/admin/sync", { credentials: "include" })
      const data = await response.json()
      setConfigs(data.sync_configs || [])
    } catch {
      if (!silent) toast.error("Hata", { description: "Yüklenirken hata oluştu" })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) return
    const eventSource = new EventSource("/admin/sync/stream", { withCredentials: true })
    eventSourceRef.current = eventSource
    setIsStreaming(true)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.sync_configs) {
          setConfigs(data.sync_configs)
          const running = new Set<string>()
          data.sync_configs.forEach((c: SyncConfig & { is_running?: boolean }) => {
            if (c.is_running) running.add(c.id)
          })
          setRunningSyncs(running)
        }
        setLoading(false)
      } catch {}
    }
    eventSource.onerror = () => {
      setIsStreaming(false)
      eventSource.close()
      eventSourceRef.current = null
      setTimeout(connectSSE, 5000)
    }
  }, [])

  /** @param silent true ise loading gösterme, bölüm unmount olmasın */
  const fetchBackendSeeds = useCallback(async (silent = false) => {
    if (!silent) setBackendSeedLoading(true)
    try {
      const response = await fetch("/admin/seed/backend", { credentials: "include" })
      const data = await response.json()
      if (response.ok && data.data?.seeds) {
        setBackendSeeds(data.data.seeds)
        fetchConfigs(silent)
      }
    } catch {
      if (!silent) toast.error("Hata", { description: "Backend seed listesi alınamadı" })
    } finally {
      if (!silent) setBackendSeedLoading(false)
    }
  }, [fetchConfigs])

  useEffect(() => {
    fetchConfigs()
    connectSSE()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchConfigs, connectSSE])

  useEffect(() => {
    fetchBackendSeeds()
  }, [fetchBackendSeeds])

  const handleSave = async (data: {
    name: string
    module_type: ModuleType
    target_url: string
    secret_token: string
    batch_size: number
    is_active: boolean
  }) => {
    if (!data.name.trim() || !data.target_url.trim()) {
      toast.error("Hata", { description: "Ad ve URL zorunlu" })
      return
    }
    try {
      new URL(data.target_url)
    } catch {
      toast.error("Hata", { description: "Geçersiz URL" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: data.name.trim(),
        module_type: data.module_type,
        target_url: data.target_url.trim(),
        secret_token: data.secret_token || null,
        batch_size: data.batch_size,
        is_active: data.is_active,
      }
      const url = editingConfig ? `/admin/sync/${editingConfig.id}` : "/admin/sync"
      const method = editingConfig ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        toast.success("Başarılı", { description: editingConfig ? "Güncellendi" : "Oluşturuldu" })
        setDrawerOpen(false)
        fetchConfigs(true)
      } else {
        const error = await response.json()
        toast.error("Hata", { description: error.error || "İşlem başarısız" })
      }
    } catch {
      toast.error("Hata", { description: "İşlem sırasında hata oluştu" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (config: SyncConfig) => {
    if (!confirm(`"${config.name}" silinsin mi?`)) return
    try {
      const response = await fetch(`/admin/sync/${config.id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) {
        toast.success("Başarılı", { description: "Silindi" })
        fetchConfigs(true)
      } else {
        toast.error("Hata", { description: "Silinemedi" })
      }
    } catch {
      toast.error("Hata", { description: "Silinemedi" })
    }
  }

  const selectedCount = selectedConfigIds.size
  const isAllSelected = configs.length > 0 && selectedCount === configs.length

  const toggleSelectConfig = (id: string) => {
    setSelectedConfigIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedConfigIds(isAllSelected ? new Set() : new Set(configs.map((c) => c.id)))
  }

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return
    if (!confirm(`${selectedCount} sync config silinsin mi?`)) return
    let ok = 0
    let fail = 0
    for (const id of selectedConfigIds) {
      try {
        const res = await fetch(`/admin/sync/${id}`, { method: "DELETE", credentials: "include" })
        if (res.ok) ok++
        else fail++
      } catch {
        fail++
      }
    }
    setSelectedConfigIds(new Set())
    fetchConfigs(true)
    if (ok) toast.success("Başarılı", { description: `${ok} config silindi${fail ? `, ${fail} başarısız` : ""}` })
    if (fail && !ok) toast.error("Hata", { description: "Silinemedi" })
  }

  const handleRunSync = async (config: SyncConfig) => {
    if (runningSyncs.has(config.id)) return
    setRunningSyncs((prev) => new Set(prev).add(config.id))
    try {
      const response = await fetch(`/admin/sync/${config.id}/run`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (response.ok) {
        toast.success("Başlatıldı", { description: `${result.total_records} kayıt, ${result.total_batches} batch` })
      } else {
        toast.error("Hata", { description: result.error })
        setRunningSyncs((prev) => {
          const n = new Set(prev)
          n.delete(config.id)
          return n
        })
      }
    } catch {
      setRunningSyncs((prev) => {
        const n = new Set(prev)
        n.delete(config.id)
        return n
      })
    }
  }

  const runBackendSeedRequest = async (body?: { seed_id: string; seed_name: string }) => {
    if (backendRunLoading) return
    setBackendRunLoading(true)
    if (body?.seed_id) setRunningSeedId(body.seed_id)
    setStreamLogOpen(true)
    setStreamLogLines([])
    setStreamSeedName(body?.seed_name ?? "Seed")
    setStreamJobId(null)
    try {
      const response = await fetch("/admin/seed/backend/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        toast.error("Hata", { description: (err as { error?: string }).error || "Seed başlatılamadı" })
        setStreamLogOpen(false)
        return
      }
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const raw of lines) {
            if (!raw.trim()) continue
            try {
              const data = JSON.parse(raw) as { type: string; job_id?: string; line?: string; status?: string }
              if (data.type === "job" && data.job_id) {
                setStreamJobId(data.job_id)
                continue
              }
              if (data.type === "job_complete" && data.job_id) {
                toast.success("Tamamlandı", {
                  description: body ? `${body.seed_name} için sync tamamlandı` : "Backend seed işlemi bitti",
                })
                fetchBackendSeeds(true)
                continue
              }
              if (data.type === "stdout" || data.type === "stderr") {
                setStreamLogLines((prev) => [...prev, { type: data.type as "stdout" | "stderr", line: data.line ?? "" }])
              }
            } catch {
              setStreamLogLines((prev) => [...prev, { type: "stdout", line: raw }])
            }
          }
        }
      }
    } catch {
      toast.error("Hata", { description: "Seed çalıştırılamadı" })
      setStreamLogOpen(false)
    } finally {
      setBackendRunLoading(false)
      setRunningSeedId(null)
    }
  }

  const handleRunBackendSeedForSeed = (seed: BackendSeedItem) =>
    runBackendSeedRequest({ seed_id: seed.id, seed_name: seed.name })

  const handleAddBackendSeed = async (seed: BackendSeedItem) => {
    if (addingSeedId != null) return
    setAddingSeedId(seed.id)
    try {
      const response = await fetch("/admin/seed/backend/ensure-config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed_id: seed.id, seed_name: seed.name, relative_path: seed.relativePath }),
      })
      if (response.ok) {
        const data = await response.json() as { sync_config_id?: string }
        toast.success("Sync eklendi", { description: `${seed.name} için sync kaydı oluşturuldu` })
        if (data.sync_config_id) {
          setBackendSeeds((prev) =>
            prev.map((s) => (s.id === seed.id ? { ...s, sync_config_id: data.sync_config_id! } : s))
          )
        }
        fetchConfigs(true)
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error("Hata", { description: (err as { error?: string }).error || "Sync eklenemedi" })
      }
    } catch {
      toast.error("Hata", { description: "Sync eklenemedi" })
    } finally {
      setAddingSeedId(null)
    }
  }

  const openCreateDrawer = () => {
    setEditingConfig(null)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        icon={<ArrowsPointingOut className="h-4 w-4 text-white" />}
        title="Data Sync"
        subtitle="Bulk veri senkronizasyonu"
        badge={{ label: isStreaming ? "Canlı" : "...", active: isStreaming }}
        actions={
          <Button variant="primary" size="small" onClick={openCreateDrawer}>
            <PlusMini className="h-4 w-4 mr-1" />Ekle
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="animate-spin h-6 w-6 text-ui-fg-interactive" />
        </div>
      ) : configs.length === 0 ? (
        <EmptyState
          icon={<ArrowsPointingOut className="h-8 w-8 text-ui-fg-muted" />}
          heading="Henüz sync yok"
          description="Bulk veri göndermek için sync oluşturun"
          actionLabel="Oluştur"
          onAction={openCreateDrawer}
        />
      ) : (
        <>
          {selectedCount > 0 && (
            <BulkActionBar
              selectedCount={selectedCount}
              onClear={() => setSelectedConfigIds(new Set())}
              onBulkDelete={handleBulkDelete}
              deleteLabel="Seçilenleri sil"
            />
          )}
          <SyncConfigTable
            configs={configs}
            selectedIds={selectedConfigIds}
            runningIds={runningSyncs}
            onToggleSelect={toggleSelectConfig}
            onToggleSelectAll={toggleSelectAll}
            onRun={handleRunSync}
            onEdit={(config) => {
              setEditingConfig(config)
              setDrawerOpen(true)
            }}
            onDelete={handleDelete}
          />
          <BackendSeedSection
            seeds={backendSeeds}
            loading={backendSeedLoading}
            runLoading={backendRunLoading}
            addingId={addingSeedId}
            runningId={runningSeedId}
            onRefresh={fetchBackendSeeds}
            onAdd={handleAddBackendSeed}
            onRun={handleRunBackendSeedForSeed}
          />
        </>
      )}

      <StreamLogDrawer
        open={streamLogOpen}
        onOpenChange={setStreamLogOpen}
        title={streamSeedName}
        lines={streamLogLines}
        loading={backendRunLoading}
        jobId={streamJobId}
      />

      <SyncForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={
          editingConfig
            ? ({
                name: editingConfig.name,
                module_type: editingConfig.module_type,
                target_url: editingConfig.target_url,
                secret_token: editingConfig.secret_token || "",
                batch_size: editingConfig.batch_size,
                is_active: editingConfig.is_active,
              } satisfies Partial<SyncFormData>)
            : undefined
        }
        onSave={handleSave}
        isEditing={!!editingConfig}
        saving={saving}
      />
    </div>
  )
}

export const config = defineRouteConfig({ label: "Data Sync", icon: ArrowsPointingOut })
export default SyncPage
