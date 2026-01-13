import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Button, 
  Text, 
  toast,
  Badge,
  IconButton,
  DropdownMenu,
  clx,
} from "@medusajs/ui"
import { 
  ArrowsPointingOut,
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  PlaySolid,
  Clock,
  Spinner,
  ArrowUpRightOnBox,
} from "@medusajs/icons"
import { SyncForm } from "../../../components/sync"

type ModuleType = "product" | "category" | "brand"

type SyncStats = {
  total_jobs: number
  success_rate: number
  total_records_synced: number
  running_jobs: number
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
  stats?: SyncStats
}

const MODULE_LABELS: Record<ModuleType, string> = { product: "Ürünler", category: "Kategoriler", brand: "Markalar", brand_category: "Marka Kategorileri" }
const MODULE_COLORS: Record<ModuleType, "blue" | "green" | "purple"> = { product: "blue", category: "green", brand: "purple" }

const SyncPage = () => {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<SyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SyncConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [runningSyncs, setRunningSyncs] = useState<Set<string>>(new Set())
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/admin/sync", { credentials: "include" })
      const data = await response.json()
      setConfigs(data.sync_configs || [])
    } catch { toast.error("Hata", { description: "Yüklenirken hata oluştu" }) }
    finally { setLoading(false) }
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
          data.sync_configs.forEach((c: SyncConfig & { is_running?: boolean }) => { if (c.is_running) running.add(c.id) })
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

  useEffect(() => {
    fetchConfigs()
    connectSSE()
    return () => { if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null } }
  }, [fetchConfigs, connectSSE])

  const handleSave = async (data: { name: string; module_type: ModuleType; target_url: string; secret_token: string; batch_size: number; is_active: boolean }) => {
    if (!data.name.trim() || !data.target_url.trim()) { toast.error("Hata", { description: "Ad ve URL zorunlu" }); return }
    try { new URL(data.target_url) } catch { toast.error("Hata", { description: "Geçersiz URL" }); return }

    setSaving(true)
    try {
      const payload = { name: data.name.trim(), module_type: data.module_type, target_url: data.target_url.trim(), secret_token: data.secret_token || null, batch_size: data.batch_size, is_active: data.is_active }
      const url = editingConfig ? `/admin/sync/${editingConfig.id}` : "/admin/sync"
      const method = editingConfig ? "PUT" : "POST"

      const response = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (response.ok) { toast.success("Başarılı", { description: editingConfig ? "Güncellendi" : "Oluşturuldu" }); setDrawerOpen(false) }
      else { const error = await response.json(); toast.error("Hata", { description: error.error || "İşlem başarısız" }) }
    } catch { toast.error("Hata", { description: "İşlem sırasında hata oluştu" }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (config: SyncConfig) => {
    if (!confirm(`"${config.name}" silinsin mi?`)) return
    try {
      const response = await fetch(`/admin/sync/${config.id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) toast.success("Başarılı", { description: "Silindi" })
    } catch { toast.error("Hata", { description: "Silinemedi" }) }
  }

  const handleRunSync = async (config: SyncConfig) => {
    if (runningSyncs.has(config.id)) return
    setRunningSyncs(prev => new Set(prev).add(config.id))
    
    try {
      const response = await fetch(`/admin/sync/${config.id}/run`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (response.ok) toast.success("Başlatıldı", { description: `${result.total_records} kayıt, ${result.total_batches} batch` })
      else { toast.error("Hata", { description: result.error }); setRunningSyncs(prev => { const n = new Set(prev); n.delete(config.id); return n }) }
    } catch { setRunningSyncs(prev => { const n = new Set(prev); n.delete(config.id); return n }) }
  }

  const formatDate = (d?: string | null) => { if (!d) return "Hiç"; return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <Container className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <ArrowsPointingOut className="h-4 w-4 text-white" />
            </div>
            <div>
              <Heading level="h1" className="text-base">Data Sync</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">Bulk veri senkronizasyonu</Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className={clx("h-1.5 w-1.5 rounded-full", isStreaming ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
              <Text size="xsmall" className="text-ui-fg-muted">{isStreaming ? "Canlı" : "..."}</Text>
            </div>
            <Button variant="primary" size="small" onClick={() => { setEditingConfig(null); setDrawerOpen(true) }}>
              <PlusMini className="h-4 w-4 mr-1" />Ekle
            </Button>
          </div>
        </div>
      </Container>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner className="animate-spin h-6 w-6 text-ui-fg-interactive" /></div>
      ) : configs.length === 0 ? (
        <Container className="py-12">
          <div className="flex flex-col items-center text-center">
            <ArrowsPointingOut className="h-8 w-8 text-ui-fg-muted mb-2" />
            <Heading level="h2" className="text-sm mb-1">Henüz sync yok</Heading>
            <Text size="xsmall" className="text-ui-fg-muted mb-3">Bulk veri göndermek için sync oluşturun</Text>
            <Button variant="secondary" size="small" onClick={() => { setEditingConfig(null); setDrawerOpen(true) }}><PlusMini className="h-4 w-4 mr-1" />Oluştur</Button>
          </div>
        </Container>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {configs.map((config) => {
            const isRunning = runningSyncs.has(config.id) || (config.stats?.running_jobs || 0) > 0
            return (
              <Container key={config.id} className="p-0">
                {/* Card Header */}
                <div className="px-3 py-2 border-b border-ui-border-base flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge color={MODULE_COLORS[config.module_type]} size="xsmall">{MODULE_LABELS[config.module_type]}</Badge>
                    <div className={clx("w-1.5 h-1.5 rounded-full", config.is_active ? "bg-emerald-500" : "bg-gray-400")} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild><IconButton variant="transparent" size="small"><EllipsisHorizontal className="h-4 w-4" /></IconButton></DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onClick={() => navigate(`/settings/sync/${config.id}`)}><ArrowUpRightOnBox className="mr-2 h-3.5 w-3.5" />Detay</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => { setEditingConfig(config); setDrawerOpen(true) }}><PencilSquare className="mr-2 h-3.5 w-3.5" />Düzenle</DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onClick={() => handleDelete(config)} className="text-ui-fg-error"><Trash className="mr-2 h-3.5 w-3.5" />Sil</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
                
                {/* Card Body */}
                <div className="p-3">
                  <Text size="small" weight="plus" className="mb-0.5">{config.name}</Text>
                  <Text size="xsmall" className="text-ui-fg-muted font-mono truncate mb-2">{config.target_url}</Text>
                  
                  {config.stats && (
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
                        <Text size="large" weight="plus">{config.stats.total_jobs}</Text>
                        <Text size="xsmall" className="text-ui-fg-muted">Job</Text>
                      </div>
                      <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
                        <Text size="large" weight="plus" className={clx(config.stats.success_rate >= 80 ? "text-emerald-600" : config.stats.success_rate >= 50 ? "text-amber-600" : "text-red-600")}>{config.stats.success_rate}%</Text>
                        <Text size="xsmall" className="text-ui-fg-muted">Başarı</Text>
                      </div>
                      <div className="text-center p-1.5 bg-ui-bg-subtle rounded">
                        <Text size="large" weight="plus">{config.stats.total_records_synced.toLocaleString()}</Text>
                        <Text size="xsmall" className="text-ui-fg-muted">Kayıt</Text>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-1 text-ui-fg-muted"><Clock className="h-3 w-3" /><span>Son:</span></div>
                    <Text size="xsmall">{formatDate(config.last_sync_at)}</Text>
                  </div>
                  
                  <Button variant="secondary" className="w-full" size="small" onClick={() => handleRunSync(config)} disabled={!config.is_active || isRunning}>
                    {isRunning ? <><Spinner className="animate-spin h-3.5 w-3.5 mr-1" />Çalışıyor</> : <><PlaySolid className="h-3.5 w-3.5 mr-1" />Başlat</>}
                  </Button>
                </div>
              </Container>
            )
          })}
        </div>
      )}

      {/* Form Drawer */}
      <SyncForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={editingConfig ? {
          name: editingConfig.name,
          module_type: editingConfig.module_type,
          target_url: editingConfig.target_url,
          secret_token: editingConfig.secret_token || "",
          batch_size: editingConfig.batch_size,
          is_active: editingConfig.is_active,
        } : undefined}
        onSave={handleSave}
        isEditing={!!editingConfig}
        saving={saving}
      />
    </div>
  )
}

export const config = defineRouteConfig({ label: "Data Sync", icon: ArrowsPointingOut })

export default SyncPage
