import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Button, 
  Text, 
  Input,
  usePrompt,
  toast,
  Badge,
  IconButton,
  DropdownMenu,
  Select,
  Switch,
  clx,
} from "@medusajs/ui"
import { 
  BellAlert, 
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  MagnifyingGlass,
  ArrowUpRightOnBox,
  PlaySolid,
  Spinner,
  Link as LinkIcon,
} from "@medusajs/icons"
import { WebhookForm } from "../../../components/webhooks"
import { StatusBadge } from "../../../components/shared"

type Webhook = {
  id: string
  event_names: string[]
  target_url: string
  secret_token?: string | null
  is_active: boolean
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

type EventInfo = {
  name: string
  description: string
  category: string
}

const WebhooksPage = () => {
  const navigate = useNavigate()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterEvent, setFilterEvent] = useState("all")
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null)
  const [events, setEvents] = useState<EventInfo[]>([])
  const [eventCategories, setEventCategories] = useState<string[]>([])
  
  const prompt = usePrompt()

  const fetchEvents = async () => {
    try {
      const response = await fetch("/admin/webhooks/events", { credentials: "include" })
      const data = await response.json()
      setEvents(data.events || [])
      setEventCategories(data.categories || [])
    } catch (error) {
      console.error("Eventler yüklenirken hata:", error)
    }
  }

  const fetchWebhooks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("q", searchQuery)
      if (filterEvent && filterEvent !== "all") params.append("event_name", filterEvent)
      
      const response = await fetch(`/admin/webhooks?${params}`, { credentials: "include" })
      const data = await response.json()
      setWebhooks(data.webhooks || [])
    } catch (error) {
      toast.error("Hata", { description: "Webhook'lar yüklenirken bir hata oluştu" })
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterEvent])

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  useEffect(() => {
    const timeoutId = setTimeout(() => fetchWebhooks(), 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleSave = async (data: { event_names: string[]; target_url: string; secret_token: string; is_active: boolean; metadata: string }) => {
    // Validate
    if (data.event_names.length === 0 || !data.target_url.trim()) {
      toast.error("Hata", { description: "En az bir event ve Hedef URL zorunludur" })
      return
    }
    try { new URL(data.target_url) } catch { toast.error("Hata", { description: "Geçersiz URL formatı" }); return }

    let parsedMetadata = null
    if (data.metadata.trim()) {
      try { parsedMetadata = JSON.parse(data.metadata) } catch { toast.error("Hata", { description: "Metadata geçerli bir JSON değil" }); return }
    }

    setSaving(true)
    try {
      const payload = { event_names: data.event_names, target_url: data.target_url, secret_token: data.secret_token || null, is_active: data.is_active, metadata: parsedMetadata }
      const url = editingWebhook ? `/admin/webhooks/${editingWebhook.id}` : "/admin/webhooks"
      const method = editingWebhook ? "PUT" : "POST"

      const response = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })

      if (response.ok) {
        toast.success("Başarılı", { description: editingWebhook ? "Webhook güncellendi" : "Webhook oluşturuldu" })
        setDrawerOpen(false)
        fetchWebhooks()
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

  const handleDelete = async (webhook: Webhook) => {
    const confirmed = await prompt({ title: "Webhook'u Sil", description: "Bu işlem geri alınamaz.", confirmText: "Sil", cancelText: "İptal" })
    if (!confirmed) return

    try {
      const response = await fetch(`/admin/webhooks/${webhook.id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) { toast.success("Başarılı", { description: "Webhook silindi" }); fetchWebhooks() }
    } catch { toast.error("Hata", { description: "Webhook silinirken hata oluştu" }) }
  }

  const handleToggle = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/admin/webhooks/${webhook.id}/toggle`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !webhook.is_active }) })
      if (response.ok) { toast.success("Başarılı", { description: `Webhook ${!webhook.is_active ? "aktif" : "pasif"} edildi` }); fetchWebhooks() }
    } catch { toast.error("Hata", { description: "Webhook durumu değiştirilirken hata oluştu" }) }
  }

  const handleTest = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.id)
    try {
      const response = await fetch(`/admin/webhooks/${webhook.id}/test`, { method: "POST", credentials: "include" })
      const result = await response.json()
      if (result.success) { toast.success("Test Başarılı", { description: `HTTP ${result.status_code}` }) }
      else { toast.error("Test Başarısız", { description: result.error || `HTTP ${result.status_code}` }) }
    } catch { toast.error("Hata", { description: "Test isteği gönderilirken hata oluştu" }) }
    finally { setTestingWebhookId(null) }
  }

  const getCategoryLabel = (cat: string) => ({ product: "Ürün", category: "Kategori", order: "Sipariş", customer: "Müşteri", brand: "Marka" }[cat] || cat)

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <Container className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <BellAlert className="h-4 w-4 text-white" />
            </div>
            <div>
              <Heading level="h1" className="text-base">Webhook'lar</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">Event'leri harici servislere bildirin</Text>
            </div>
          </div>
          <Button variant="primary" size="small" onClick={() => { setEditingWebhook(null); setDrawerOpen(true) }}>
            <PlusMini className="h-4 w-4 mr-1" />
            Ekle
          </Button>
        </div>
      </Container>

      {/* Filters & List */}
      <Container className="p-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-ui-border-base">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" />
            <Input placeholder="Ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 h-7 text-xs" />
          </div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <Select.Trigger className="w-40 h-7 text-xs"><Select.Value placeholder="Tüm Eventler" /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Tüm Eventler</Select.Item>
              {eventCategories.map((category) => (
                <Select.Group key={category}>
                  <Select.Label>{getCategoryLabel(category)}</Select.Label>
                  {events.filter(e => e.category === category).map((event) => (
                    <Select.Item key={event.name} value={event.name}>{event.name}</Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.Content>
          </Select>
          <Text size="xsmall" className="text-ui-fg-muted">{webhooks.length} webhook</Text>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="animate-spin h-6 w-6 text-ui-fg-interactive" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <BellAlert className="h-8 w-8 text-ui-fg-muted mb-2" />
            <Text weight="plus" className="text-sm mb-1">Henüz webhook yok</Text>
            <Text size="xsmall" className="text-ui-fg-muted mb-3">Event'leri bildirmek için webhook ekleyin</Text>
            <Button variant="secondary" size="small" onClick={() => { setEditingWebhook(null); setDrawerOpen(true) }}>
              <PlusMini className="h-4 w-4 mr-1" />Ekle
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-ui-border-base">
            {webhooks.map((webhook) => (
              <div 
                key={webhook.id} 
                onClick={() => navigate(`/settings/webhooks/${webhook.id}`)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-ui-bg-subtle cursor-pointer group"
              >
                <div className={clx("w-2 h-2 rounded-full flex-shrink-0", webhook.is_active ? "bg-emerald-500" : "bg-gray-400")} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {(webhook.event_names || []).slice(0, 2).map((e) => (
                      <Badge key={e} color="blue" size="xsmall">{e}</Badge>
                    ))}
                    {(webhook.event_names || []).length > 2 && (
                      <Badge color="grey" size="xsmall">+{webhook.event_names.length - 2}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="h-3 w-3 text-ui-fg-muted" />
                    <Text size="xsmall" className="text-ui-fg-muted font-mono truncate">{webhook.target_url}</Text>
                    {webhook.secret_token && <Badge color="orange" size="xsmall">🔒</Badge>}
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={webhook.is_active} onCheckedChange={() => handleToggle(webhook)} size="small" />
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <IconButton variant="transparent" size="small" onClick={() => handleTest(webhook)} disabled={testingWebhookId === webhook.id}>
                    <PlaySolid className={clx("h-3.5 w-3.5", testingWebhookId === webhook.id && "animate-pulse")} />
                  </IconButton>
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <IconButton variant="transparent" size="small"><EllipsisHorizontal className="h-4 w-4" /></IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onClick={() => navigate(`/settings/webhooks/${webhook.id}`)}>
                        <ArrowUpRightOnBox className="mr-2 h-3.5 w-3.5" />Detay
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => { setEditingWebhook(webhook); setDrawerOpen(true) }}>
                        <PencilSquare className="mr-2 h-3.5 w-3.5" />Düzenle
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onClick={() => handleDelete(webhook)} className="text-ui-fg-error">
                        <Trash className="mr-2 h-3.5 w-3.5" />Sil
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {/* Form Drawer */}
      <WebhookForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={editingWebhook ? {
          event_names: editingWebhook.event_names || [],
          target_url: editingWebhook.target_url,
          secret_token: editingWebhook.secret_token || "",
          is_active: editingWebhook.is_active,
          metadata: editingWebhook.metadata ? JSON.stringify(editingWebhook.metadata, null, 2) : "",
        } : undefined}
        events={events}
        onSave={handleSave}
        isEditing={!!editingWebhook}
        saving={saving}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Webhook'lar",
  icon: BellAlert,
})

export default WebhooksPage
