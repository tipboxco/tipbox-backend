import { useState, useEffect } from "react"
import { 
  Drawer, 
  Label, 
  Input, 
  Switch, 
  Button, 
  Text, 
  Badge,
  Checkbox,
} from "@medusajs/ui"
import { MagnifyingGlass, XMarkMini } from "@medusajs/icons"

type EventInfo = {
  name: string
  description: string
  category: string
}

type WebhookFormData = {
  event_names: string[]
  target_url: string
  secret_token: string
  is_active: boolean
  metadata: string
}

type WebhookFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Partial<WebhookFormData>
  events: EventInfo[]
  onSave: (data: WebhookFormData) => Promise<void>
  isEditing?: boolean
  saving?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  product: "Ürün",
  category: "Kategori",
  order: "Sipariş",
  customer: "Müşteri",
  brand: "Marka",
}

export const WebhookForm = ({
  open,
  onOpenChange,
  initialData,
  events,
  onSave,
  isEditing = false,
  saving = false,
}: WebhookFormProps) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>(initialData?.event_names || [])
  const [targetUrl, setTargetUrl] = useState(initialData?.target_url || "")
  const [secretToken, setSecretToken] = useState(initialData?.secret_token || "")
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
  const [metadata, setMetadata] = useState(initialData?.metadata || "")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (open && initialData) {
      setSelectedEvents(initialData.event_names || [])
      setTargetUrl(initialData.target_url || "")
      setSecretToken(initialData.secret_token || "")
      setIsActive(initialData.is_active ?? true)
      setMetadata(initialData.metadata || "")
    }
  }, [open, initialData])

  const toggleEvent = (name: string) => {
    setSelectedEvents(prev => 
      prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]
    )
  }

  const filteredEvents = searchQuery
    ? events.filter(e => 
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events

  const categories = [...new Set(filteredEvents.map(e => e.category))]

  const handleSubmit = async () => {
    await onSave({
      event_names: selectedEvents,
      target_url: targetUrl,
      secret_token: secretToken,
      is_active: isActive,
      metadata,
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSearchQuery("") }}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="text-sm">
            {isEditing ? "Webhook Düzenle" : "Yeni Webhook"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 p-3 overflow-y-auto">
          {/* Events */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label weight="plus" className="text-xs">Eventler *</Label>
              <div className="flex gap-2">
                {selectedEvents.length > 0 && (
                  <button onClick={() => setSelectedEvents([])} className="text-xs text-ui-fg-muted hover:text-ui-fg-base">
                    Temizle
                  </button>
                )}
                <button onClick={() => setSelectedEvents(events.map(e => e.name))} className="text-xs text-ui-fg-interactive">
                  Tümü
                </button>
              </div>
            </div>

            <div className="relative">
              <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-ui-fg-muted" />
              <Input
                placeholder="Event ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>

            {selectedEvents.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 bg-ui-bg-subtle rounded max-h-16 overflow-y-auto">
                {selectedEvents.map((name) => (
                  <Badge key={name} color="blue" size="xsmall" className="pr-0.5">
                    {name}
                    <button onClick={() => toggleEvent(name)} className="ml-0.5 p-0.5 hover:bg-ui-bg-base rounded">
                      <XMarkMini className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="border rounded max-h-36 overflow-y-auto">
              {categories.map((category) => {
                const categoryEvents = filteredEvents.filter(e => e.category === category)
                const allSelected = categoryEvents.every(e => selectedEvents.includes(e.name))
                
                return (
                  <div key={category} className="border-b last:border-b-0">
                    <div className="px-2 py-1.5 bg-ui-bg-subtle flex items-center justify-between sticky top-0">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => {
                            if (allSelected) {
                              setSelectedEvents(prev => prev.filter(e => !categoryEvents.map(ce => ce.name).includes(e)))
                            } else {
                              setSelectedEvents(prev => [...new Set([...prev, ...categoryEvents.map(e => e.name)])])
                            }
                          }}
                        />
                        <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
                          {CATEGORY_LABELS[category] || category}
                        </Text>
                      </div>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {categoryEvents.filter(e => selectedEvents.includes(e.name)).length}/{categoryEvents.length}
                      </Text>
                    </div>
                    <div className="p-1">
                      {categoryEvents.map((event) => (
                        <label key={event.name} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-ui-bg-subtle cursor-pointer">
                          <Checkbox checked={selectedEvents.includes(event.name)} onCheckedChange={() => toggleEvent(event.name)} />
                          <div className="min-w-0">
                            <Text size="xsmall" weight="plus">{event.name}</Text>
                            <Text size="xsmall" className="text-ui-fg-muted truncate">{event.description}</Text>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">{selectedEvents.length} event seçildi</Text>
          </div>

          {/* Target URL */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Hedef URL *</Label>
            <Input
              placeholder="https://api.example.com/webhook"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              type="url"
              className="h-7 text-xs"
            />
          </div>

          {/* Secret Token */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Secret Token</Label>
            <Input
              placeholder="Opsiyonel"
              value={secretToken}
              onChange={(e) => setSecretToken(e.target.value)}
              type="password"
              className="h-7 text-xs"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-1.5 px-2 bg-ui-bg-subtle rounded">
            <Label className="text-xs" weight="plus">Aktif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Metadata (JSON)</Label>
            <Input
              placeholder='{"key": "value"}'
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button 
              variant="primary" 
              size="small" 
              onClick={handleSubmit}
              disabled={saving || selectedEvents.length === 0 || !targetUrl.trim()}
            >
              {saving ? "Kaydediliyor..." : isEditing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

