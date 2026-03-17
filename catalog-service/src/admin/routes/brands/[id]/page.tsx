import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useNavigate, unstable_usePrompt as usePrompt } from "react-router-dom"
import { backendUrl } from "../../../lib/config"
import {
  Container,
  Heading,
  Table,
  Button,
  Text,
  Input,
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
  Check,
} from "@medusajs/icons"
import { ProductPickerModal } from "../../../components/product-picker"
import { SerpSearchDrawer } from "../../../components/serp-search"
import { EmptyState } from "../../../components/empty-state"
import { Modal, ModalBody, ModalFooter } from "../../../components/modal"
import { CategoryTreeSelect, useCategoryCache } from "../../../components/category-tree-select"

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

type Product = {
  id: string
  title: string
  handle: string
  thumbnail?: string
  status: string
  variants?: { id: string }[]
  categories?: { id: string; name: string }[]
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
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrandProducts, setSelectedBrandProducts] = useState<Set<string>>(new Set())

  // Product picker modal state
  const [pickerModalOpen, setPickerModalOpen] = useState(false)

  // SERP search modal state
  const [serpModalOpen, setSerpModalOpen] = useState(false)

  // Product categories (cached)
  const { categories: productCategories, loading: categoriesLoading } = useCategoryCache()

  // Pending category changes: productId → new categoryId (null = remove)
  const [pendingCategoryChanges, setPendingCategoryChanges] = useState<Map<string, string | null>>(new Map())
  const [savingCategories, setSavingCategories] = useState(false)

  // Bulk category assign modal
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)

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

  // Pending changes count
  const pendingCount = pendingCategoryChanges.size

  // Get effective category for a product (pending change or original)
  const getEffectiveCategoryId = useCallback((product: Product): string | null => {
    if (pendingCategoryChanges.has(product.id)) {
      return pendingCategoryChanges.get(product.id) ?? null
    }
    return product.categories?.[0]?.id || null
  }, [pendingCategoryChanges])

  // Check if a product has a pending change
  const hasChange = useCallback((productId: string): boolean => {
    return pendingCategoryChanges.has(productId)
  }, [pendingCategoryChanges])

  // Fetch brand data
  const fetchBrand = useCallback(async (page: number = currentPage, limit: number = itemsPerPage) => {
    if (!id) return

    setLoading(true)
    try {
      const offset = (page - 1) * limit
      const [brandResponse, productsResponse] = await Promise.all([
        fetch(`${backendUrl}/admin/brands/${id}`, { credentials: "include" }),
        fetch(`${backendUrl}/admin/brands/${id}/products?limit=${limit}&offset=${offset}`, { credentials: "include" })
      ])

      const brandData = await brandResponse.json()
      const productsData: ProductsResponse = await productsResponse.json()

      setBrand(brandData.brand)
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

  // Clear pending changes when page changes
  useEffect(() => {
    setPendingCategoryChanges(new Map())
  }, [currentPage, itemsPerPage])

  // Warn before leaving page with unsaved changes (SPA navigation)
  usePrompt({
    when: pendingCount > 0,
    message: `${pendingCount} kaydedilmemiş kategori değişikliği var. Sayfadan ayrılmak istediğinize emin misiniz?`,
  })

  // Warn before closing tab/browser with unsaved changes
  useEffect(() => {
    if (pendingCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [pendingCount])

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
      if (pendingCount > 0) {
        const confirmed = window.confirm(`${pendingCount} kaydedilmemiş değişiklik var. Sayfa değiştirilsin mi?`)
        if (!confirmed) return
      }
      setCurrentPage(newPage)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleItemsPerPageChange = (newLimit: number) => {
    if (pendingCount > 0) {
      const confirmed = window.confirm(`${pendingCount} kaydedilmemiş değişiklik var. Devam edilsin mi?`)
      if (!confirmed) return
    }
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


  const handleDeleteBrand = async () => {
    if (!brand || !id) return

    if (deleteConfirmName !== brand.name) {
      toast.error("Hata", { description: "Marka adı eşleşmiyor" })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`${backendUrl}/admin/brands/${id}`, { method: "DELETE", credentials: "include" })
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
      const response = await fetch(`${backendUrl}/admin/brands/${id}/products/all`, {
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
          fetch(`${backendUrl}/admin/brands/${id}/products`, {
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
      const response = await fetch(`${backendUrl}/admin/brands/${id}/products`, {
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
          fetch(`${backendUrl}/admin/brands/${id}/products`, {
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

  // Stage a category change (don't save yet)
  const handleStageCategoryChange = useCallback((productId: string, categoryId: string | null) => {
    setPendingCategoryChanges(prev => {
      const next = new Map(prev)
      // Find the product's original category
      const product = brandProducts.find(p => p.id === productId)
      const originalCategoryId = product?.categories?.[0]?.id || null

      // If the new value matches the original, remove the pending change
      if (categoryId === originalCategoryId) {
        next.delete(productId)
      } else {
        next.set(productId, categoryId)
      }
      return next
    })
  }, [brandProducts])

  // Discard all pending changes
  const handleDiscardChanges = useCallback(() => {
    setPendingCategoryChanges(new Map())
  }, [])

  // Save all pending category changes
  const handleSaveCategoryChanges = useCallback(async () => {
    if (pendingCount === 0) return
    setSavingCategories(true)

    const entries = Array.from(pendingCategoryChanges.entries())
    let successCount = 0
    const batchSize = 5

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(([productId, categoryId]) =>
          fetch(`${backendUrl}/admin/products/${productId}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: categoryId ? [{ id: categoryId }] : [],
            }),
          })
        )
      )
      successCount += results.filter(r => r.status === "fulfilled" && (r.value as Response).ok).length
    }

    // Update local state
    setBrandProducts(prev =>
      prev.map(p => {
        const newCatId = pendingCategoryChanges.get(p.id)
        if (newCatId === undefined) return p
        const cat = newCatId ? productCategories.find(c => c.id === newCatId) : null
        return { ...p, categories: cat ? [cat] : [] }
      })
    )

    setPendingCategoryChanges(new Map())
    setSavingCategories(false)

    if (successCount === entries.length) {
      toast.success("Başarılı", { description: `${successCount} ürünün kategorisi güncellendi` })
    } else {
      toast.warning("Kısmi başarı", {
        description: `${successCount}/${entries.length} ürün güncellendi, ${entries.length - successCount} hata`,
      })
    }
  }, [pendingCategoryChanges, pendingCount, productCategories])

  // Bulk category: stage changes for all selected products
  const handleBulkCategoryStage = useCallback(() => {
    if (selectedBrandProducts.size === 0) return
    setPendingCategoryChanges(prev => {
      const next = new Map(prev)
      for (const productId of selectedBrandProducts) {
        const product = brandProducts.find(p => p.id === productId)
        const originalCategoryId = product?.categories?.[0]?.id || null
        if (bulkCategoryId === originalCategoryId) {
          next.delete(productId)
        } else {
          next.set(productId, bulkCategoryId)
        }
      }
      return next
    })
    toast.success("Değişiklikler eklendi", {
      description: `${selectedBrandProducts.size} ürün için kategori değişikliği hazırlandı. Kaydetmek için "Değişiklikleri Kaydet" butonunu kullanın.`,
    })
    setBulkCategoryModalOpen(false)
    setBulkCategoryId(null)
    setSelectedBrandProducts(new Set())
  }, [selectedBrandProducts, bulkCategoryId, brandProducts])

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
              <DropdownMenu.Item onClick={() => navigate(`/brands/${id}/edit`)}>
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
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={() => setSerpModalOpen(true)}>
              <MagnifyingGlass />SERP ile Ara
            </Button>

            {/* Save Changes Button — only visible when there are pending changes */}
            {pendingCount > 0 && (
              <>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={handleDiscardChanges}
                  disabled={savingCategories}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleSaveCategoryChanges}
                  disabled={savingCategories}
                >
                  {savingCategories ? (
                    <>
                      <Spinner className="animate-spin h-3.5 w-3.5" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Değişiklikleri Kaydet ({pendingCount})
                    </>
                  )}
                </Button>
              </>
            )}

            <Button variant="secondary" size="small" onClick={() => setPickerModalOpen(true)}>
              <PlusMini />Ürün Ekle
            </Button>
          </div>
        </div>

        {/* Pending changes info bar */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-ui-bg-highlight border-b border-ui-border-base">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-ui-tag-blue-bg">
              <Text size="xsmall" weight="plus" className="text-ui-tag-blue-text">{pendingCount}</Text>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              kaydedilmemiş kategori değişikliği var
            </Text>
          </div>
        )}

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
                  <Table.HeaderCell>Kategori</Table.HeaderCell>
                  <Table.HeaderCell>Durum</Table.HeaderCell>
                  <Table.HeaderCell>Varyant</Table.HeaderCell>
                  <Table.HeaderCell className="w-[60px]"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredBrandProducts.map((product) => {
                  const productHasChange = hasChange(product.id)
                  const effectiveCategoryId = getEffectiveCategoryId(product)
                  return (
                    <Table.Row
                      key={product.id}
                      className={[
                        "group cursor-pointer transition-colors",
                        productHasChange
                          ? "bg-ui-bg-highlight hover:bg-ui-bg-highlight-hover"
                          : "hover:bg-ui-bg-subtle-hover",
                      ].join(" ")}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('input[type="checkbox"]') || target.closest('button') || target.closest('[role="combobox"]') || target.closest('[role="listbox"]')) {
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
                      <Table.Cell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <CategoryTreeSelect
                            compact
                            categories={productCategories}
                            value={effectiveCategoryId}
                            onChange={(value) => handleStageCategoryChange(product.id, value)}
                            disabled={savingCategories}
                            loading={categoriesLoading}
                            placeholder="Kategori seç..."
                          />
                          {productHasChange && (
                            <div className="w-1.5 h-1.5 rounded-full bg-ui-tag-blue-icon shrink-0" title="Kaydedilmemiş değişiklik" />
                          )}
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
                  )
                })}
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
          <CommandBar.Command action={() => setBulkCategoryModalOpen(true)} label="Kategori Ata" shortcut="c" />
          <CommandBar.Command action={handleRemoveSelectedProducts} label="Kaldır" shortcut="d" />
          <CommandBar.Command action={() => setSelectedBrandProducts(new Set())} label="İptal" shortcut="esc" />
        </CommandBar.Bar>
      </CommandBar>

      {/* Bulk Category Assign Modal */}
      <Modal
        open={bulkCategoryModalOpen}
        onClose={() => {
          setBulkCategoryModalOpen(false)
          setBulkCategoryId(null)
        }}
        title="Toplu Kategori Ata"
        size="md"
      >
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Text size="small" className="text-ui-fg-subtle">
              Seçili <strong className="text-ui-fg-base">{selectedBrandProducts.size}</strong> ürüne kategori atayın.
              Değişiklikler hemen kaydedilmez, "Değişiklikleri Kaydet" butonuyla toplu olarak kaydedilir.
            </Text>
            <div className="flex flex-col gap-2">
              <Label weight="plus">Kategori</Label>
              <CategoryTreeSelect
                categories={productCategories}
                value={bulkCategoryId}
                onChange={(value) => setBulkCategoryId(value)}
                loading={categoriesLoading}
                placeholder="Kategori seçin..."
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setBulkCategoryModalOpen(false)
                setBulkCategoryId(null)
              }}
            >
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkCategoryStage}
            >
              Değişiklikleri Hazırla
            </Button>
          </div>
        </ModalFooter>
      </Modal>

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

      {/* SERP Search Drawer */}
      <SerpSearchDrawer
        open={serpModalOpen}
        onOpenChange={setSerpModalOpen}
        brandId={id!}
        onImportSuccess={() => fetchBrand(currentPage, itemsPerPage)}
        title="SERP ile Ürün Ara"
        description="Google Shopping sonuçlarını markaya aktarın"
      />

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
