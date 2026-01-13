import { useState, useEffect } from "react"
import { 
  Drawer, 
  Label, 
  Input, 
  Select,
  Switch, 
  Button, 
  Text,
} from "@medusajs/ui"

type ModuleType = "product" | "category" | "brand"

type SyncFormData = {
  name: string
  module_type: ModuleType
  target_url: string
  secret_token: string
  batch_size: number
  is_active: boolean
}

type SyncFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Partial<SyncFormData>
  onSave: (data: SyncFormData) => Promise<void>
  isEditing?: boolean
  saving?: boolean
}

export const SyncForm = ({
  open,
  onOpenChange,
  initialData,
  onSave,
  isEditing = false,
  saving = false,
}: SyncFormProps) => {
  const [name, setName] = useState(initialData?.name || "")
  const [moduleType, setModuleType] = useState<ModuleType>(initialData?.module_type || "product")
  const [targetUrl, setTargetUrl] = useState(initialData?.target_url || "")
  const [secretToken, setSecretToken] = useState(initialData?.secret_token || "")
  const [batchSize, setBatchSize] = useState(String(initialData?.batch_size || 1000))
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "")
      setModuleType(initialData.module_type || "product")
      setTargetUrl(initialData.target_url || "")
      setSecretToken(initialData.secret_token || "")
      setBatchSize(String(initialData.batch_size || 1000))
      setIsActive(initialData.is_active ?? true)
    }
  }, [open, initialData])

  const handleSubmit = async () => {
    await onSave({
      name,
      module_type: moduleType,
      target_url: targetUrl,
      secret_token: secretToken,
      batch_size: parseInt(batchSize) || 1000,
      is_active: isActive,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="text-sm">
            {isEditing ? "Sync Düzenle" : "Yeni Sync"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 p-3">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Ad *</Label>
            <Input
              placeholder="Örn: Product Sync"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Module Type */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Modül *</Label>
            <Select value={moduleType} onValueChange={(v) => setModuleType(v as ModuleType)}>
              <Select.Trigger className="h-7">
                <Select.Value placeholder="Modül seçin" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="product">Ürünler</Select.Item>
                <Select.Item value="category">Kategoriler</Select.Item>
                <Select.Item value="brand">Markalar</Select.Item>
                <Select.Item value="brand_category">Marka Kategorileri</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {/* Target URL */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Hedef URL *</Label>
            <Input
              placeholder="https://api.example.com/sync"
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

          {/* Batch Size */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" weight="plus">Batch Boyutu</Label>
            <Input
              placeholder="1000"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              type="number"
              className="h-7 text-xs"
            />
            <Text size="xsmall" className="text-ui-fg-muted">Her istekte gönderilecek kayıt sayısı</Text>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-1.5 px-2 bg-ui-bg-subtle rounded">
            <Label className="text-xs" weight="plus">Aktif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button 
              variant="primary" 
              size="small" 
              onClick={handleSubmit}
              disabled={saving || !name.trim() || !targetUrl.trim()}
            >
              {saving ? "Kaydediliyor..." : isEditing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

