import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
  Container, 
  Heading, 
  Button, 
  Text, 
  Input,
  Label,
  toast,
  IconButton,
  Checkbox,
  Select,
  Textarea,
} from "@medusajs/ui"
import { 
  ArrowLeft,
  Spinner,
  Photo,
  TagSolid,
} from "@medusajs/icons"
import { ImageUploadField } from "../../../../components/media"
import { TagInput } from "../../../../components/tag-input/tag-input"

type Brand = {
  id: string
  name: string
  handle?: string | null
  website_url?: string | null
  logo_url?: string | null
  banner_url?: string | null
  metadata?: any | null
  rank?: number | null
  ispopular?: boolean | null
  tags?: any | null
  category_id?: string | null
  category?: {
    id: string
    title: string
  } | null
  created_at?: string
  updated_at?: string
}

type BrandCategory = {
  id: string
  title: string
}

const BrandEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [brandName, setBrandName] = useState("")
  const [brandHandle, setBrandHandle] = useState<string>("")
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState<string>("")
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [brandBannerUrl, setBrandBannerUrl] = useState<string | null>(null)
  const [brandRank, setBrandRank] = useState<string>("")
  const [brandIsPopular, setBrandIsPopular] = useState<boolean>(false)
  const [brandTags, setBrandTags] = useState<string[]>([])
  const [brandMetadata, setBrandMetadata] = useState<string>("")
  const [brandCategoryId, setBrandCategoryId] = useState<string | null>(null)
  const [brandCategories, setBrandCategories] = useState<BrandCategory[]>([])

  // Fetch brand data
  const fetchBrand = useCallback(async () => {
    if (!id) return
    
    setLoading(true)
    try {
      const response = await fetch(`/admin/brands/${id}`, { credentials: "include" })
      if (!response.ok) {
        toast.error("Hata", { description: "Marka bulunamadı" })
        navigate(`/brands/${id}`)
        return
      }
      
      const brandData = await response.json()
      const brand = brandData.brand
      
      setBrand(brand)
      setBrandName(brand?.name || "")
      setBrandHandle(brand?.handle || "")
      setBrandWebsiteUrl(brand?.website_url || "")
      setBrandLogoUrl(brand?.logo_url || null)
      setBrandBannerUrl(brand?.banner_url || null)
      setBrandRank(brand?.rank?.toString() || "")
      setBrandIsPopular(brand?.ispopular || false)
      setBrandTags(Array.isArray(brand?.tags) ? brand.tags : brand?.tags ? [brand.tags] : [])
      setBrandMetadata(brand?.metadata ? JSON.stringify(brand.metadata, null, 2) : "")
      setBrandCategoryId(brand?.category_id || brand?.category?.id || null)
    } catch (error) {
      toast.error("Hata", { description: "Marka bilgileri yüklenirken hata oluştu" })
      navigate(`/brands/${id}`)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    fetchBrand()
  }, [fetchBrand])

  // Fetch brand categories
  useEffect(() => {
    const fetchBrandCategories = async () => {
      try {
        const response = await fetch("/admin/brand-categories?limit=1000", {
          credentials: "include",
        })
        const data = await response.json()
        setBrandCategories(data.brand_categories || [])
      } catch (error) {
        console.error("Brand kategorileri yüklenirken hata:", error)
      }
    }
    fetchBrandCategories()
  }, [])

  // Image upload handler
  const handleImageUpload = async (base64String: string): Promise<string | null> => {
    try {
      const response = await fetch("/admin/media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: base64String,
          filename: "brand-image.jpg",
          mimeType: "image/jpeg",
        }),
      })
      
      if (!response.ok) {
        throw new Error("Resim yüklenemedi")
      }
      
      const data = await response.json()
      return data.file?.url || null
    } catch (error) {
      console.error("Image upload error:", error)
      throw error
    }
  }

  // Update brand
  const handleUpdateBrand = async () => {
    if (!brandName.trim() || !id) return
    setSaving(true)
    try {
      // Parse JSON fields
      let parsedMetadata = null
      
      // Tags artık array olarak geliyor
      const parsedTags = brandTags.length > 0 ? brandTags : null
      
      if (brandMetadata.trim()) {
        try {
          parsedMetadata = JSON.parse(brandMetadata)
        } catch {
          toast.error("Hata", { description: "Metadata geçerli bir JSON formatında olmalıdır" })
          setSaving(false)
          return
        }
      }

      const updatePayload = { 
        name: brandName,
        handle: brandHandle.trim() || null,
        website_url: brandWebsiteUrl.trim() || null,
        logo_url: brandLogoUrl,
        banner_url: brandBannerUrl,
        rank: brandRank.trim() ? parseInt(brandRank) : null,
        ispopular: brandIsPopular,
        tags: parsedTags,
        metadata: parsedMetadata,
        category_id: brandCategoryId || null,
      }
      
      const response = await fetch(`/admin/brands/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      })
      
      if (response.ok) {
        toast.success("Başarılı", { description: "Marka güncellendi" })
        navigate(`/brands/${id}`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error("Hata", { 
          description: errorData.message || "Marka güncellenirken hata oluştu" 
        })
      }
    } catch (error) {
      console.error("Marka güncelleme hatası:", error)
      toast.error("Hata", { description: "Marka güncellenirken hata oluştu" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="animate-spin h-8 w-8 text-ui-fg-interactive" />
      </div>
    )
  }

  if (!brand) {
    return (
      <Container className="py-8">
        <Text className="text-ui-fg-subtle">Marka bulunamadı</Text>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Container className="divide-y p-0">
        <div className="flex items-center gap-4 px-6 py-4">
          <IconButton variant="transparent" size="small" onClick={() => navigate(`/brands/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <div className="flex-1">
            <Heading level="h1" className="text-ui-fg-base">Marka Düzenle</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {brand.name}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/brands/${id}`)}>
              İptal
            </Button>
            <Button 
              variant="primary" 
              onClick={handleUpdateBrand} 
              disabled={saving || !brandName.trim()}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Container>

      {/* Form Content */}
      <Container className="divide-y p-0">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content - 2 columns */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                  {/* Basic Information Section */}
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-ui-border-base">
                      <TagSolid className="h-5 w-5 text-ui-fg-subtle" />
                      <Heading level="h2" className="text-ui-fg-base text-lg">Temel Bilgiler</Heading>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="brand-name" weight="plus" size="small">
                          Marka Adı <span className="text-ui-fg-error">*</span>
                        </Label>
                        <Input
                          id="brand-name"
                          placeholder="Marka adını girin..."
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          autoFocus
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="brand-handle" weight="plus" size="small">
                            Handle
                          </Label>
                          <Input
                            id="brand-handle"
                            placeholder="Örn: nike, adidas, apple..."
                            value={brandHandle}
                            onChange={(e) => setBrandHandle(e.target.value)}
                          />
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            URL'de kullanılacak benzersiz tanımlayıcı
                          </Text>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="brand-category" weight="plus" size="small">
                            Kategori
                          </Label>
                          <Select 
                            value={brandCategoryId || "__none__"} 
                            onValueChange={(value) => setBrandCategoryId(value === "__none__" ? null : value)}
                          >
                            <Select.Trigger>
                              <Select.Value placeholder="Kategori seçin..." />
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="__none__">Kategori yok</Select.Item>
                              {brandCategories.map((category) => (
                                <Select.Item key={category.id} value={category.id}>
                                  {category.title}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="brand-website-url" weight="plus" size="small">
                          Website URL
                        </Label>
                        <Input
                          id="brand-website-url"
                          type="text"
                          placeholder="example.com veya https://example.com"
                          value={brandWebsiteUrl}
                          onChange={(e) => setBrandWebsiteUrl(e.target.value)}
                        />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Markanın resmi web sitesi (http/https ile başlamak zorunda değil)
                        </Text>
                      </div>
                    </div>
                  </div>

                  {/* Media Section */}
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-ui-border-base">
                      <Photo className="h-5 w-5 text-ui-fg-subtle" />
                      <Heading level="h2" className="text-ui-fg-base text-lg">Medya</Heading>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <Label weight="plus" size="small">Marka Logosu</Label>
                        <ImageUploadField
                          config={{
                            key: "logo",
                            label: "Marka Logosu",
                            required: false,
                            previewHeight: 140,
                          }}
                          value={brandLogoUrl}
                          isEditing={true}
                          isSaving={saving}
                          onChange={(value) => {
                            const next = Array.isArray(value) ? value[0] ?? null : value
                            if (next && typeof next === "string" && next.startsWith("data:image")) {
                              handleImageUpload(next).then((url) => {
                                setBrandLogoUrl(url)
                              }).catch((error) => {
                                console.error("Image upload error:", error)
                                toast.error("Hata", { description: "Resim yüklenirken hata oluştu" })
                              })
                            } else {
                              setBrandLogoUrl(next)
                            }
                          }}
                          onRemove={() => setBrandLogoUrl(null)}
                        />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Marka logonuzu yükleyin (önerilen: 512x512px)
                        </Text>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label weight="plus" size="small">Banner Görseli</Label>
                        <ImageUploadField
                          config={{
                            key: "banner",
                            label: "Banner Görseli",
                            required: false,
                            previewHeight: 140,
                          }}
                          value={brandBannerUrl}
                          isEditing={true}
                          isSaving={saving}
                          onChange={(value) => {
                            const next = Array.isArray(value) ? value[0] ?? null : value
                            if (next && typeof next === "string" && next.startsWith("data:image")) {
                              handleImageUpload(next).then((url) => {
                                setBrandBannerUrl(url)
                              }).catch((error) => {
                                console.error("Image upload error:", error)
                                toast.error("Hata", { description: "Resim yüklenirken hata oluştu" })
                              })
                            } else {
                              setBrandBannerUrl(next)
                            }
                          }}
                          onRemove={() => setBrandBannerUrl(null)}
                        />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Banner görselinizi yükleyin (önerilen: 1920x400px)
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="flex flex-col gap-8">
                  {/* Settings Section */}
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-ui-border-base">
                      <TagSolid className="h-5 w-5 text-ui-fg-subtle" />
                      <Heading level="h2" className="text-ui-fg-base text-lg">Ayarlar</Heading>
                    </div>
                    
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="brand-rank" weight="plus" size="small">
                          Sıralama (Rank)
                        </Label>
                        <Input
                          id="brand-rank"
                          type="number"
                          placeholder="0"
                          value={brandRank}
                          onChange={(e) => setBrandRank(e.target.value)}
                        />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Düşük değerler önce görünür
                        </Text>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="brand-is-popular" weight="plus" size="small">
                            Popüler Marka
                          </Label>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Popüler markalar öne çıkarılır
                          </Text>
                        </div>
                        <Checkbox
                          id="brand-is-popular"
                          checked={brandIsPopular}
                          onCheckedChange={(checked) => setBrandIsPopular(checked === true)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Advanced Section */}
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-ui-border-base">
                      <TagSolid className="h-5 w-5 text-ui-fg-subtle" />
                      <Heading level="h2" className="text-ui-fg-base text-lg">Gelişmiş</Heading>
                    </div>
                    
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <TagInput
                          value={brandTags}
                          onChange={setBrandTags}
                          placeholder="Tag ekleyin ve Enter'a basın..."
                          label="Tags"
                          description="Marka için etiketler ekleyin"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="brand-metadata" weight="plus" size="small">
                          Metadata (JSON)
                        </Label>
                        <Textarea
                          id="brand-metadata"
                          placeholder='{"key": "value"}'
                          value={brandMetadata}
                          onChange={(e) => setBrandMetadata(e.target.value)}
                          rows={5}
                          className="font-mono text-xs"
                        />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Ek metadata bilgileri
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
    </div>
  )
}

export default BrandEditPage
