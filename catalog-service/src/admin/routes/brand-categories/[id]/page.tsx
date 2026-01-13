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
  IconButton,
  DropdownMenu,
  Checkbox,
  Avatar,
  Select,
} from "@medusajs/ui"
import { 
  AcademicCapSolid as FolderSolid, 
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  MagnifyingGlass,
  ArrowLeft,
  XMark,
  TagSolid,
  Spinner,
  ChevronLeftMini,
  ChevronRightMini,
} from "@medusajs/icons"
import { BrandPickerModal } from "../../../components/brand-picker"
import { EmptyState } from "../../../components/empty-state"
import { ImageUploadField } from "../../../components/media/image-upload-field"
import { Modal, ModalBody, ModalFooter } from "../../../components/modal"

type BrandCategory = {
  id: string
  title: string
  thumbnail?: string | null
  created_at?: string
  updated_at?: string
  brands?: Brand[]
}

type Brand = {
  id: string
  name: string
  logo_url?: string | null
}

type BrandsResponse = {
  brands: Brand[]
  count: number
  limit: number
  offset: number
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const BrandCategoryDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Brand category state
  const [brandCategory, setBrandCategory] = useState<BrandCategory | null>(null)
  const [categoryBrands, setCategoryBrands] = useState<Brand[]>([])
  const [totalBrandCount, setTotalBrandCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [categoryTitle, setCategoryTitle] = useState("")
  const [categoryThumbnail, setCategoryThumbnail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())

  // Brand picker modal state
  const [pickerModalOpen, setPickerModalOpen] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Delete all brands dialog state
  const [deleteAllBrandsDialogOpen, setDeleteAllBrandsDialogOpen] = useState(false)
  const [deletingAllBrands, setDeletingAllBrands] = useState(false)

  // Fetch brand category data
  const fetchBrandCategory = useCallback(async (page: number = currentPage, limit: number = itemsPerPage) => {
    if (!id) return
    
    setLoading(true)
    try {
      const offset = (page - 1) * limit
      const [categoryResponse, brandsResponse] = await Promise.all([
        fetch(`/admin/brand-categories/${id}`, { credentials: "include" }),
        fetch(`/admin/brand-categories/${id}/brands?limit=${limit}&offset=${offset}`, { credentials: "include" })
      ])
      
      const categoryData = await categoryResponse.json()
      const brandsData: BrandsResponse = await brandsResponse.json()
      
      setBrandCategory(categoryData.brand_category)
      setCategoryTitle(categoryData.brand_category?.title || "")
      setCategoryThumbnail(categoryData.brand_category?.thumbnail || null)
      setCategoryBrands(brandsData.brands || [])
      setTotalBrandCount(brandsData.count || 0)
    } catch (error) {
      toast.error("Hata", { description: "Brand kategorisi bilgileri yüklenirken hata oluştu" })
    } finally {
      setLoading(false)
    }
  }, [id, currentPage, itemsPerPage])

  useEffect(() => {
    fetchBrandCategory(currentPage, itemsPerPage)
  }, [currentPage, itemsPerPage])

  // Search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage === 1) {
        fetchBrandCategory(1, itemsPerPage)
      } else {
        setCurrentPage(1)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Filter category brands (client-side filtering for search)
  const filteredCategoryBrands = useMemo(() => {
    if (!searchQuery.trim()) return categoryBrands
    const query = searchQuery.toLowerCase()
    return categoryBrands.filter(b => 
      b.name.toLowerCase().includes(query) ||
      b.id.toLowerCase().includes(query)
    )
  }, [categoryBrands, searchQuery])

  // Pagination calculations
  const totalPages = Math.ceil(totalBrandCount / itemsPerPage)
  const startItem = totalBrandCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalBrandCount)

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

  // Handle brand selection
  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrands(prev => {
      const newSet = new Set(prev)
      if (newSet.has(brandId)) {
        newSet.delete(brandId)
      } else {
        newSet.add(brandId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedBrands.size === filteredCategoryBrands.length) {
      setSelectedBrands(new Set())
    } else {
      setSelectedBrands(new Set(filteredCategoryBrands.map(b => b.id)))
    }
  }

  // Handle brand picker confirm
  const handleBrandPickerConfirm = async (brandIds: string[]) => {
    try {
      const response = await fetch(`/admin/brand-categories/${id}/brands`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_ids: brandIds }),
      })

      if (response.ok) {
        toast.success("Başarılı", {
          description: `${brandIds.length} marka kategoriye eklendi`,
        })
        fetchBrandCategory(currentPage, itemsPerPage)
      } else {
        const error = await response.json()
        toast.error("Hata", {
          description: error.message || "Markalar eklenirken bir hata oluştu",
        })
      }
    } catch (error) {
      console.error("Markalar eklenirken hata:", error)
      toast.error("Hata", {
        description: "Markalar eklenirken bir hata oluştu",
      })
    }
  }

  // Handle delete selected brands
  const handleDeleteSelectedBrands = async () => {
    if (selectedBrands.size === 0) return

    try {
      const brandIds = Array.from(selectedBrands)
      const deletePromises = brandIds.map(brandId =>
        fetch(`/admin/brand-categories/${id}/brands`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_id: brandId }),
        })
      )

      await Promise.all(deletePromises)
      
      toast.success("Başarılı", {
        description: `${brandIds.length} marka kategoriden kaldırıldı`,
      })
      
      setSelectedBrands(new Set())
      fetchBrandCategory(currentPage, itemsPerPage)
    } catch (error) {
      console.error("Markalar silinirken hata:", error)
      toast.error("Hata", {
        description: "Markalar silinirken bir hata oluştu",
      })
    }
  }

  // Handle update brand category
  const handleUpdateBrandCategory = async () => {
    if (!categoryTitle.trim()) return

    setSaving(true)
    try {
      const response = await fetch(`/admin/brand-categories/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: categoryTitle,
          thumbnail: categoryThumbnail,
        }),
      })

      if (response.ok) {
        toast.success("Başarılı", {
          description: "Brand kategorisi güncellendi",
        })
        setEditDrawerOpen(false)
        fetchBrandCategory(currentPage, itemsPerPage)
      }
    } catch (error) {
      console.error("Brand kategorisi güncellenirken hata:", error)
      toast.error("Hata", {
        description: "Brand kategorisi güncellenirken bir hata oluştu",
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle delete brand category
  const handleDeleteBrandCategory = async () => {
    if (deleteConfirmTitle !== brandCategory?.title) {
      toast.error("Hata", {
        description: "Kategori adı eşleşmiyor",
      })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/admin/brand-categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast.success("Başarılı", {
          description: "Brand kategorisi silindi",
        })
        navigate("/brand-categories")
      }
    } catch (error) {
      console.error("Brand kategorisi silinirken hata:", error)
      toast.error("Hata", {
        description: "Brand kategorisi silinirken bir hata oluştu",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Handle delete all brands
  const handleDeleteAllBrands = async () => {
    setDeletingAllBrands(true)
    try {
      // Tüm brandleri getir
      const allBrandsResponse = await fetch(`/admin/brand-categories/${id}/brands/all`, {
        credentials: "include",
      })
      const allBrandsData: BrandsResponse = await allBrandsResponse.json()
      
      if (allBrandsData.brands.length === 0) {
        toast.info("Bilgi", {
          description: "Kategoride silinecek marka yok",
        })
        setDeleteAllBrandsDialogOpen(false)
        return
      }

      const deletePromises = allBrandsData.brands.map(brand =>
        fetch(`/admin/brand-categories/${id}/brands`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_id: brand.id }),
        })
      )

      await Promise.all(deletePromises)
      
      toast.success("Başarılı", {
        description: `Tüm markalar kategoriden kaldırıldı`,
      })
      
      setDeleteAllBrandsDialogOpen(false)
      fetchBrandCategory(currentPage, itemsPerPage)
    } catch (error) {
      console.error("Tüm markalar silinirken hata:", error)
      toast.error("Hata", {
        description: "Tüm markalar silinirken bir hata oluştu",
      })
    } finally {
      setDeletingAllBrands(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="animate-spin h-8 w-8" />
          <Text size="small" className="text-ui-fg-subtle">
            Yükleniyor...
          </Text>
        </div>
      </div>
    )
  }

  if (!brandCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Text weight="plus" className="text-ui-fg-base mb-1">
          Brand kategorisi bulunamadı
        </Text>
        <Button variant="secondary" size="small" onClick={() => navigate("/brand-categories")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri Dön
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <IconButton
              variant="transparent"
              size="small"
              onClick={() => navigate("/brand-categories")}
            >
              <ArrowLeft className="h-5 w-5" />
            </IconButton>
            <div className="flex items-center gap-3">
              {brandCategory.thumbnail ? (
                <Avatar 
                  src={brandCategory.thumbnail} 
                  fallback={brandCategory.title.charAt(0)} 
                  size="base" 
                  className="rounded-md"
                />
              ) : (
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-ui-bg-component border border-ui-border-base">
                  <FolderSolid className="text-ui-fg-subtle h-5 w-5" />
                </div>
              )}
              <div>
                <Heading level="h1" className="text-ui-fg-base">
                  {brandCategory.title}
                </Heading>
                <Text size="small" className="text-ui-fg-subtle mt-0.5">
                  {totalBrandCount} marka
                </Text>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={() => setEditDrawerOpen(true)}>
              <PencilSquare className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent" size="small">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => setDeleteDialogOpen(true)} className="text-ui-fg-error">
                  <Trash className="mr-2 h-4 w-4" />
                  Kategoriyi Sil
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      </Container>

      {/* Brands Section */}
      <Container className="divide-y p-0">
        {/* Actions Bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <MagnifyingGlass className="text-ui-fg-muted h-4 w-4" />
            <Input
              placeholder="Marka ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedBrands.size > 0 && (
              <Button
                variant="secondary"
                size="small"
                onClick={handleDeleteSelectedBrands}
              >
                <Trash className="mr-2 h-4 w-4" />
                Seçilenleri Kaldır ({selectedBrands.size})
              </Button>
            )}
            <Button variant="primary" size="small" onClick={() => setPickerModalOpen(true)}>
              <PlusMini />
              Marka Ekle
            </Button>
          </div>
        </div>

        {/* Brands Table */}
        <div className="px-0">
          {filteredCategoryBrands.length === 0 ? (
            <EmptyState
              icon={<TagSolid className="h-8 w-8" />}
              title={searchQuery ? "Sonuç bulunamadı" : "Henüz marka yok"}
              description={
                searchQuery
                  ? `"${searchQuery}" aramasına uygun marka bulunamadı`
                  : "Bu kategoriye marka eklemek için yukarıdaki 'Marka Ekle' butonunu kullanın"
              }
              action={
                !searchQuery && (
                  <Button variant="secondary" size="small" onClick={() => setPickerModalOpen(true)}>
                    <PlusMini />
                    Marka Ekle
                  </Button>
                )
              }
            />
          ) : (
            <>
              <Table>
                <Table.Header>
                  <Table.Row className="bg-ui-bg-subtle">
                    <Table.HeaderCell className="pl-6 w-[50px]">
                      <Checkbox
                        checked={selectedBrands.size === filteredCategoryBrands.length && filteredCategoryBrands.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </Table.HeaderCell>
                    <Table.HeaderCell className="pl-6">Marka</Table.HeaderCell>
                    <Table.HeaderCell className="w-[100px]"></Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredCategoryBrands.map((brand) => (
                    <Table.Row 
                      key={brand.id} 
                      className="group hover:bg-ui-bg-subtle-hover cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('input[type="checkbox"]') || target.closest('button')) {
                          return
                        }
                        navigate(`/brands/${brand.id}`)
                      }}
                    >
                      <Table.Cell className="pl-6">
                        <Checkbox
                          checked={selectedBrands.has(brand.id)}
                          onCheckedChange={() => toggleBrandSelection(brand.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-3">
                          {brand.logo_url ? (
                            <Avatar src={brand.logo_url} fallback={brand.name.charAt(0)} size="small" />
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                              <TagSolid className="text-ui-fg-muted h-4 w-4" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <Text weight="plus" size="small" className="text-ui-fg-base">{brand.name}</Text>
                            <Text size="xsmall" className="text-ui-fg-muted">{brand.id}</Text>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconButton
                            variant="transparent"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleBrandSelection(brand.id)
                              handleDeleteSelectedBrands()
                            }}
                          >
                            <XMark className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

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
                      {startItem}-{endItem} / {totalBrandCount.toLocaleString()}
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
            </>
          )}
        </div>
      </Container>

      {/* Edit Drawer */}
      <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Brand Kategorisini Düzenle</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-title" weight="plus">
                Kategori Başlığı <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                id="category-title"
                value={categoryTitle}
                onChange={(e) => setCategoryTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-thumbnail" weight="plus">
                Küçük Resim (Thumbnail)
              </Label>
              <ImageUploadField
                config={{
                  key: "category-thumbnail",
                  label: "Küçük Resim",
                  required: false,
                  previewHeight: 80,
                }}
                value={categoryThumbnail}
                isEditing={true}
                isSaving={saving}
                onChange={(url) => setCategoryThumbnail(url || null)}
                onRemove={() => setCategoryThumbnail(null)}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setEditDrawerOpen(false)}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateBrandCategory}
                disabled={saving || !categoryTitle.trim()}
              >
                {saving ? "Kaydediliyor..." : "Güncelle"}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Brand Picker Modal */}
      <BrandPickerModal
        open={pickerModalOpen}
        onClose={() => setPickerModalOpen(false)}
        onConfirm={handleBrandPickerConfirm}
        title="Marka Seç"
        description="Bu kategoriye eklemek istediğiniz markaları seçin"
        confirmButtonText="Marka Ekle"
        excludedBrandIds={categoryBrands.map(b => b.id)}
      />

      {/* Delete Category Modal */}
      <Modal open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <ModalBody>
          <Heading level="h2" className="text-ui-fg-base mb-2">
            Brand Kategorisini Sil
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mb-4">
            Bu işlem geri alınamaz. Kategoriyi silmek için kategori adını girin:
          </Text>
          <Text weight="plus" size="small" className="text-ui-fg-base mb-2">
            {brandCategory.title}
          </Text>
          <Input
            placeholder="Kategori adını girin"
            value={deleteConfirmTitle}
            onChange={(e) => setDeleteConfirmTitle(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setDeleteDialogOpen(false)
              setDeleteConfirmTitle("")
            }}
          >
            İptal
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteBrandCategory}
            disabled={deleting || deleteConfirmTitle !== brandCategory.title}
          >
            {deleting ? "Siliniyor..." : "Sil"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default BrandCategoryDetailPage

