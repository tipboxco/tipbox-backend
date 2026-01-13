import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
  Container, 
  Heading, 
  Table, 
  Button, 
  Text, 
  Input,
  Drawer,
  Label,
  toast,
  Badge,
  IconButton,
  DropdownMenu,
  Checkbox,
  Avatar,
  CommandBar,
  Select,
} from "@medusajs/ui"
import { 
  TagSolid, 
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  MagnifyingGlass,
  ArrowLeft,
  XMark,
  Photo,
  ShoppingBag,
  Spinner,
  ChevronLeftMini,
  ChevronRightMini,
} from "@medusajs/icons"
import { ProductPickerModal } from "../../../components/product-picker"
import { EmptyState } from "../../../components/empty-state"
import { ImageUploadField } from "../../../components/media/image-upload-field"
import { Modal, ModalBody, ModalFooter } from "../../../components/modal"

type Brand = {
  id: string
  name: string
  logo_url?: string | null
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

type Product = {
  id: string
  title: string
  handle: string
  thumbnail?: string
  status: string
  variants?: { id: string }[]
}

type ProductsResponse = {
  products: Product[]
  count: number
  limit: number
  offset: number
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const BrandDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Brand state
  const [brand, setBrand] = useState<Brand | null>(null)
  const [brandProducts, setBrandProducts] = useState<Product[]>([])
  const [totalProductCount, setTotalProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [brandName, setBrandName] = useState("")
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [brandCategoryId, setBrandCategoryId] = useState<string | null>(null)
  const [brandCategories, setBrandCategories] = useState<BrandCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrandProducts, setSelectedBrandProducts] = useState<Set<string>>(new Set())

  // Product picker modal state
  const [pickerModalOpen, setPickerModalOpen] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Delete all products dialog state
  const [deleteAllProductsDialogOpen, setDeleteAllProductsDialogOpen] = useState(false)
  const [deletingAllProducts, setDeletingAllProducts] = useState(false)

  // Fetch brand data
  const fetchBrand = useCallback(async (page: number = currentPage, limit: number = itemsPerPage) => {
    if (!id) return
    
    setLoading(true)
    try {
      const offset = (page - 1) * limit
      const [brandResponse, productsResponse] = await Promise.all([
        fetch(`/admin/brands/${id}`, { credentials: "include" }),
        fetch(`/admin/brands/${id}/products?limit=${limit}&offset=${offset}`, { credentials: "include" })
      ])
      
      const brandData = await brandResponse.json()
      const productsData: ProductsResponse = await productsResponse.json()
      
      setBrand(brandData.brand)
      setBrandName(brandData.brand?.name || "")
      setBrandLogoUrl(brandData.brand?.logo_url || null)
      setBrandCategoryId(brandData.brand?.category_id || brandData.brand?.category?.id || null)
      setBrandProducts(productsData.products || [])
      setTotalProductCount(productsData.count || 0)
    } catch (error) {
      toast.error("Hata", { description: "Marka bilgileri yüklenirken hata oluştu" })
    } finally {
      setLoading(false)
    }
  }, [id, currentPage, itemsPerPage])

  useEffect(() => {
    fetchBrand(currentPage, itemsPerPage)
  }, [currentPage, itemsPerPage])

  // Fetch brand categories for dropdown
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

  // Search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage === 1) {
        fetchBrand(1, itemsPerPage)
      } else {
        setCurrentPage(1)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Filter brand products (client-side filtering for search)
  const filteredBrandProducts = useMemo(() => {
    if (!searchQuery.trim()) return brandProducts
    const query = searchQuery.toLowerCase()
    return brandProducts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.handle.toLowerCase().includes(query)
    )
  }, [brandProducts, searchQuery])

  // Pagination calculations
  const totalPages = Math.ceil(totalProductCount / itemsPerPage)
  const startItem = totalProductCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalProductCount)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit)
    setCurrentPage(1)
  }

  // Pagination page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push("...")
      }
      
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push("...")
      }
      
      pages.push(totalPages)
    }
    
    return pages
  }

  // Image upload handler
  const handleImageUpload = async (base64String: string): Promise<string | null> => {
    try {
      const response = await fetch("/admin/media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: base64String,
          filename: "brand-logo.jpg",
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

  // Brand operations
  const handleUpdateBrand = async () => {
    if (!brandName.trim() || !id) return
    setSaving(true)
    try {
      const updatePayload = { 
        name: brandName,
        logo_url: brandLogoUrl,
        category_id: brandCategoryId || null,
      }
      
      const response = await fetch(`/admin/brands/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      })
      if (response.ok) {
        const data = await response.json()
        // State'i direkt güncelle (fetchBrand'i beklemeden)
        if (data.brand) {
          setBrand(data.brand)
          setBrandLogoUrl(data.brand.logo_url || null)
        }
        toast.success("Başarılı", { description: "Marka güncellendi" })
        setEditDrawerOpen(false)
        // Sadece ürünleri fetch et (brand zaten güncellendi)
        const offset = (currentPage - 1) * itemsPerPage
        try {
          const productsResponse = await fetch(`/admin/brands/${id}/products?limit=${itemsPerPage}&offset=${offset}`, { 
            credentials: "include" 
          })
          const productsData: ProductsResponse = await productsResponse.json()
          setBrandProducts(productsData.products || [])
          setTotalProductCount(productsData.count || 0)
        } catch {
          // Ürün fetch hatası önemli değil, sadece log
        }
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

  const handleDeleteBrand = async () => {
    if (!brand || !id) return
    
    if (deleteConfirmName !== brand.name) {
      toast.error("Hata", { description: "Marka adı eşleşmiyor" })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/admin/brands/${id}`, { method: "DELETE", credentials: "include" })
      if (response.ok) {
        toast.success("Başarılı", { description: "Marka silindi" })
        navigate("/brands")
      } else {
        toast.error("Hata", { description: "Marka silinirken hata oluştu" })
      }
    } catch {
      toast.error("Hata", { description: "Marka silinirken hata oluştu" })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteConfirmName("")
    }
  }

  const handleDeleteAllProducts = async () => {
    if (!id) return
    
    setDeletingAllProducts(true)
    try {
      const response = await fetch(`/admin/brands/${id}/products/all`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast.success("Başarılı", { 
          description: `${data.deleted_count} ürün silindi` 
        })
        setDeleteAllProductsDialogOpen(false)
        fetchBrand(currentPage, itemsPerPage)
      } else {
        toast.error("Hata", { 
          description: data.errors?.join(", ") || "Ürünler silinirken hata oluştu" 
        })
      }
    } catch {
      toast.error("Hata", { description: "Ürünler silinirken hata oluştu" })
    } finally {
      setDeletingAllProducts(false)
    }
  }

  // Product operations - add products from picker
  const handleAddProducts = async (productIds: string[]) => {
    if (productIds.length === 0 || !id) return
    
    let successCount = 0
    const batchSize = 5
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(productId =>
          fetch(`/admin/brands/${id}/products`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })
        )
      )
      successCount += results.filter(r => r.status === "fulfilled").length
    }

      toast.success("Başarılı", { description: `${successCount} ürün eklendi` })
    fetchBrand(currentPage, itemsPerPage)
  }

  const handleRemoveProduct = async (productId: string) => {
    if (!id) return
    try {
      const response = await fetch(`/admin/brands/${id}/products`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      })
      if (response.ok) {
        toast.success("Başarılı", { description: "Ürün kaldırıldı" })
        fetchBrand(currentPage, itemsPerPage)
      }
    } catch {
      toast.error("Hata", { description: "Ürün kaldırılırken hata oluştu" })
    }
  }

  const handleRemoveSelectedProducts = async () => {
    if (selectedBrandProducts.size === 0 || !id) return
    try {
      await Promise.all(
        Array.from(selectedBrandProducts).map(productId =>
          fetch(`/admin/brands/${id}/products`, {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })
        )
      )
      toast.success("Başarılı", { description: `${selectedBrandProducts.size} ürün kaldırıldı` })
      setSelectedBrandProducts(new Set())
      fetchBrand(currentPage, itemsPerPage)
    } catch {
      toast.error("Hata", { description: "Ürünler kaldırılırken hata oluştu" })
    }
  }

  // Selection handlers
  const toggleBrandProductSelection = (productId: string) => {
    setSelectedBrandProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) newSet.delete(productId)
      else newSet.add(productId)
      return newSet
    })
  }

  const toggleAllBrandProducts = () => {
    if (selectedBrandProducts.size === filteredBrandProducts.length) {
      setSelectedBrandProducts(new Set())
    } else {
      setSelectedBrandProducts(new Set(filteredBrandProducts.map(p => p.id)))
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="divide-y p-0">
        <div className="flex items-center gap-4 px-6 py-4">
          <IconButton variant="transparent" size="small" onClick={() => navigate("/brands")}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {brand.logo_url ? (
                <Avatar src={brand.logo_url} fallback={brand.name.charAt(0)} size="base" className="rounded-lg" />
              ) : (
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ui-bg-component border border-ui-border-base">
                  <TagSolid className="text-ui-fg-subtle h-5 w-5" />
                </div>
              )}
              <div>
                <Heading level="h1" className="text-ui-fg-base">{brand.name}</Heading>
                <div className="flex items-center gap-2 mt-1">
                  <Text size="small" className="text-ui-fg-muted font-mono">{brand.id}</Text>
                  {brand.category && (
                    <>
                      <Text size="small" className="text-ui-fg-muted">•</Text>
                      <Badge color="blue" size="small">
                        {brand.category.title}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="transparent" size="small"><EllipsisHorizontal /></IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onClick={() => setEditDrawerOpen(true)}>
                <PencilSquare className="mr-2 h-4 w-4" />Düzenle
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item 
                onClick={() => setDeleteAllProductsDialogOpen(true)} 
                className="text-ui-fg-error"
                disabled={totalProductCount === 0}
              >
                <Trash className="mr-2 h-4 w-4" />Tüm Ürünleri Sil
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => setDeleteDialogOpen(true)} className="text-ui-fg-error">
                <Trash className="mr-2 h-4 w-4" />Markayı Sil
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </Container>

      {/* Products Section */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2" className="text-ui-fg-base">Ürünler</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">Bu markaya ait ürünleri yönetin</Text>
          </div>
          <Button variant="secondary" size="small" onClick={() => setPickerModalOpen(true)}>
            <PlusMini />Ürün Ekle
          </Button>
        </div>

        <div className="flex items-center gap-3 px-6 py-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Ürün ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              size="small"
            />
          </div>
          <Badge color="grey" size="small">{totalProductCount} ürün</Badge>
        </div>

        <div className="px-0">
          {filteredBrandProducts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="text-ui-fg-muted h-8 w-8" />}
              title={searchQuery ? "Sonuç bulunamadı" : "Henüz ürün yok"}
              description={searchQuery 
                ? `"${searchQuery}" aramasına uygun ürün bulunamadı` 
                : "Bu markaya ürün ekleyerek başlayın"
              }
              actionLabel={!searchQuery ? "Ürün Ekle" : undefined}
              onAction={!searchQuery ? () => setPickerModalOpen(true) : undefined}
            />
          ) : (
            <Table>
              <Table.Header>
                <Table.Row className="bg-ui-bg-subtle">
                  <Table.HeaderCell className="w-[48px] pl-6">
                    <Checkbox
                      checked={selectedBrandProducts.size === filteredBrandProducts.length && filteredBrandProducts.length > 0}
                      onCheckedChange={toggleAllBrandProducts}
                    />
                  </Table.HeaderCell>
                  <Table.HeaderCell>Ürün</Table.HeaderCell>
                  <Table.HeaderCell>Durum</Table.HeaderCell>
                  <Table.HeaderCell>Varyant</Table.HeaderCell>
                  <Table.HeaderCell className="w-[60px]"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredBrandProducts.map((product) => (
                  <Table.Row 
                    key={product.id} 
                    className="group hover:bg-ui-bg-subtle-hover cursor-pointer"
                    onClick={(e) => {
                      // Checkbox veya silme butonuna tıklanırsa yönlendirme yapma
                      const target = e.target as HTMLElement
                      if (target.closest('input[type="checkbox"]') || target.closest('button')) {
                        return
                      }
                      navigate(`/products/${product.id}`)
                    }}
                  >
                    <Table.Cell className="pl-6">
                      <Checkbox
                        checked={selectedBrandProducts.has(product.id)}
                        onCheckedChange={() => toggleBrandProductSelection(product.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        {product.thumbnail ? (
                          <Avatar src={product.thumbnail} fallback={product.title.charAt(0)} size="small" />
                        ) : (
                          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                            <Photo className="text-ui-fg-muted h-4 w-4" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <Text weight="plus" size="small" className="text-ui-fg-base">{product.title}</Text>
                          <Text size="xsmall" className="text-ui-fg-muted">{product.handle}</Text>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={product.status === "published" ? "green" : "grey"} size="small">
                        {product.status === "published" ? "Yayında" : "Taslak"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">{product.variants?.length || 0} varyant</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <IconButton 
                        variant="transparent" 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveProduct(product.id)
                        }}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <XMark className="text-ui-fg-error h-4 w-4" />
                      </IconButton>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-ui-border-base">
              <div className="flex items-center gap-2">
                <Text size="small" className="text-ui-fg-muted">
                  Sayfa başına:
                </Text>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}>
                  <Select.Trigger className="w-20">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <Select.Item key={option} value={option.toString()}>
                        {option}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Text size="small" className="text-ui-fg-muted">
                  {startItem}-{endItem} / {totalProductCount.toLocaleString()}
                </Text>
                
                <div className="flex items-center gap-1">
                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="disabled:opacity-50"
                  >
                    <ChevronLeftMini className="h-4 w-4" />
                  </IconButton>

                  {getPageNumbers().map((page, index) => {
                    if (page === "...") {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-ui-fg-muted">
                          ...
                        </span>
                      )
                    }

                    const pageNum = page as number
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "primary" : "transparent"}
                        size="small"
                        onClick={() => handlePageChange(pageNum)}
                        className="min-w-[32px]"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}

                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="disabled:opacity-50"
                  >
                    <ChevronRightMini className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>

      {/* Bulk Action Command Bar */}
      <CommandBar open={selectedBrandProducts.size > 0}>
        <CommandBar.Bar>
          <CommandBar.Value>{selectedBrandProducts.size} ürün seçildi</CommandBar.Value>
          <CommandBar.Seperator />
          <CommandBar.Command action={handleRemoveSelectedProducts} label="Kaldır" shortcut="d" />
          <CommandBar.Command action={() => setSelectedBrandProducts(new Set())} label="İptal" shortcut="esc" />
        </CommandBar.Bar>
      </CommandBar>

      {/* Edit Brand Drawer */}
      <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header><Drawer.Title>Marka Düzenle</Drawer.Title></Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-brand-name" weight="plus">
                Marka Adı <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                id="edit-brand-name"
                placeholder="Marka adını girin..."
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-category" weight="plus">
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
              <Text size="small" className="text-ui-fg-subtle">
                Markayı bir kategoriye atayabilirsiniz
              </Text>
            </div>
            <ImageUploadField
              config={{
                key: "logo",
                label: "Marka Logosu",
                required: false,
                previewHeight: 80,
              }}
              value={brandLogoUrl}
              isEditing={true}
              isSaving={saving}
              onChange={(value) => {
                console.log("ImageUploadField onChange:", value)
                // Base64 string ise, önce upload et, sonra URL'yi al
                if (value && value.startsWith("data:image")) {
                  // Base64 string, upload et
                  handleImageUpload(value).then((url) => {
                    console.log("Uploaded image URL:", url)
                    setBrandLogoUrl(url)
                  }).catch((error) => {
                    console.error("Image upload error:", error)
                    toast.error("Hata", { description: "Resim yüklenirken hata oluştu" })
                  })
                } else {
                  // URL string, direkt set et
                  setBrandLogoUrl(value)
                }
              }}
              onRemove={() => setBrandLogoUrl(null)}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditDrawerOpen(false)}>İptal</Button>
              <Button variant="primary" onClick={handleUpdateBrand} disabled={saving || !brandName.trim()}>
                {saving ? "Kaydediliyor..." : "Güncelle"}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Delete Brand Modal */}
      <Modal
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setDeleteConfirmName("")
        }}
        title="Markayı Sil"
        size="md"
      >
        <ModalBody>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Text size="small" className="text-ui-fg-subtle">
                Bu işlem geri alınamaz. Markayı silmek için aşağıya marka adını girin: <strong className="text-ui-fg-base">{brand?.name}</strong>
              </Text>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm-name" weight="plus">
                Marka Adı <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                id="delete-confirm-name"
                placeholder={brand?.name}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setDeleteDialogOpen(false)
              setDeleteConfirmName("")
            }}>
              İptal
            </Button>
            <Button 
              variant="danger" 
              onClick={handleDeleteBrand} 
              disabled={deleting || deleteConfirmName !== brand?.name}
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Delete All Products Modal */}
      <Modal
        open={deleteAllProductsDialogOpen}
        onClose={() => setDeleteAllProductsDialogOpen(false)}
        title="Tüm Ürünleri Sil"
        size="md"
      >
        <ModalBody>
          <div className="flex flex-col gap-2">
            <Text size="small" className="text-ui-fg-subtle">
              Bu markaya bağlı tüm ürünler (<strong className="text-ui-fg-base">{totalProductCount}</strong> adet) silinecek. Bu işlem geri alınamaz.
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted mt-2">
              Ürünler silindikten sonra marka ile olan bağlantıları kaldırılacak, ancak ürünlerin kendileri silinmeyecektir.
            </Text>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteAllProductsDialogOpen(false)}>
              İptal
            </Button>
            <Button 
              variant="danger" 
              onClick={handleDeleteAllProducts} 
              disabled={deletingAllProducts}
            >
              {deletingAllProducts ? "Siliniyor..." : "Tümünü Sil"}
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Product Picker Modal */}
      <ProductPickerModal
        open={pickerModalOpen}
        onClose={() => setPickerModalOpen(false)}
        onConfirm={handleAddProducts}
        fetchEndpoint="/admin/products"
        additionalQueryParams={{ has_brand: "false" }}
        title="Ürün Seç"
        description="Markaya eklemek istediğiniz ürünleri seçin"
        confirmButtonText="Ürün Ekle"
        emptyMessage="Eklenebilecek ürün yok"
        emptySearchMessage="aramasına uygun ürün bulunamadı"
      />
    </div>
  )
}

export default BrandDetailPage
