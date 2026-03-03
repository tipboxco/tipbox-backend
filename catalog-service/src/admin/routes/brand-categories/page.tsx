import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { backendUrl } from "../../lib/config"
import { 
  Container, 
  Heading, 
  Table, 
  Button, 
  Text, 
  Input,
  Drawer,
  Label,
  usePrompt,
  toast,
  Badge,
  IconButton,
  DropdownMenu,
  Select,
  Avatar,
} from "@medusajs/ui"
import { 
  AcademicCapSolid as FolderSolid, 
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  MagnifyingGlass,
  ArrowUpRightOnBox,
  ChevronLeftMini,
  ChevronRightMini,
} from "@medusajs/icons"
import { ImageUploadField } from "../../components/media"

type BrandCategory = {
  id: string
  title: string
  thumbnail?: string | null
  brand_count?: number
  created_at?: string
  updated_at?: string
}

type BrandCategoriesResponse = {
  brand_categories: BrandCategory[]
  count: number
  limit: number
  offset: number
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const BrandCategoriesPage = () => {
  const navigate = useNavigate()
  const [brandCategories, setBrandCategories] = useState<BrandCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBrandCategory, setEditingBrandCategory] = useState<BrandCategory | null>(null)
  const [categoryTitle, setCategoryTitle] = useState("")
  const [categoryThumbnail, setCategoryThumbnail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  
  const prompt = usePrompt()

  const fetchBrandCategories = useCallback(async (page: number = 1, limit: number = itemsPerPage, search: string = "") => {
    setLoading(true)
    try {
      const offset = (page - 1) * limit
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        include_brand_count: "true",
      })
      
      if (search) {
        params.append("q", search)
      }
      
      const response = await fetch(`${backendUrl}/admin/brand-categories?${params}`, {
        credentials: "include",
      })
      const data: BrandCategoriesResponse = await response.json()
      
      setBrandCategories(data.brand_categories || [])
      setTotalCount(data.count || 0)
    } catch (error) {
      console.error("Brand kategorileri yüklenirken hata:", error)
      toast.error("Hata", {
        description: "Brand kategorileri yüklenirken bir hata oluştu",
      })
    } finally {
      setLoading(false)
    }
  }, [itemsPerPage])

  useEffect(() => {
    fetchBrandCategories(currentPage, itemsPerPage, searchQuery)
  }, [currentPage, itemsPerPage, fetchBrandCategories])

  // Search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage === 1) {
        fetchBrandCategories(1, itemsPerPage, searchQuery)
      } else {
        setCurrentPage(1)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)

  const openCreateDrawer = () => {
    setEditingBrandCategory(null)
    setCategoryTitle("")
    setCategoryThumbnail(null)
    setDrawerOpen(true)
  }

  const openEditDrawer = (brandCategory: BrandCategory) => {
    setEditingBrandCategory(brandCategory)
    setCategoryTitle(brandCategory.title)
    setCategoryThumbnail(brandCategory.thumbnail || null)
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!categoryTitle.trim()) return

    setSaving(true)
    try {
      if (editingBrandCategory) {
        const response = await fetch(`${backendUrl}/admin/brand-categories/${editingBrandCategory.id}`, {
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
            description: "Brand kategorisi başarıyla güncellendi",
          })
          setDrawerOpen(false)
          fetchBrandCategories(currentPage, itemsPerPage, searchQuery)
        }
      } else {
        const response = await fetch(`${backendUrl}/admin/brand-categories`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: categoryTitle,
            thumbnail: categoryThumbnail,
          }),
        })

        if (response.ok) {
          toast.success("Başarılı", {
            description: "Brand kategorisi başarıyla oluşturuldu",
          })
          setDrawerOpen(false)
          fetchBrandCategories(currentPage, itemsPerPage, searchQuery)
        }
      }
    } catch (error) {
      console.error("Brand kategorisi kaydedilirken hata:", error)
      toast.error("Hata", {
        description: "Brand kategorisi kaydedilirken bir hata oluştu",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (brandCategory: BrandCategory) => {
    const confirmed = await prompt({
      title: "Brand Kategorisini Sil",
      description: `"${brandCategory.title}" brand kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      cancelText: "İptal",
    })

    if (!confirmed) return

    try {
      const response = await fetch(`${backendUrl}/admin/brand-categories/${brandCategory.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast.success("Başarılı", {
          description: "Brand kategorisi başarıyla silindi",
        })
        // Eğer son sayfada tek item varsa ve silindiyse, önceki sayfaya git
        if (brandCategories.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1)
        } else {
          fetchBrandCategories(currentPage, itemsPerPage, searchQuery)
        }
      }
    } catch (error) {
      console.error("Brand kategorisi silinirken hata:", error)
      toast.error("Hata", {
        description: "Brand kategorisi silinirken bir hata oluştu",
      })
    }
  }

  const handleRowClick = (brandCategory: BrandCategory) => {
    navigate(`/brand-categories/${brandCategory.id}`)
  }

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
      // Tüm sayfaları göster
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // İlk sayfa
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push("...")
      }
      
      // Mevcut sayfa etrafındaki sayfalar
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push("...")
      }
      
      // Son sayfa
      pages.push(totalPages)
    }
    
    return pages
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1" className="text-ui-fg-base">
              Brand Kategorileri
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Markalarınızı kategorilere göre organize edin
            </Text>
          </div>
          <Button variant="primary" size="small" onClick={openCreateDrawer}>
            <PlusMini />
            Kategori Ekle
          </Button>
        </div>
      </Container>

      {/* Main Content */}
      <Container className="divide-y p-0">
        {/* Search & Filters */}
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Kategori ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              size="small"
            />
          </div>
          <div className="flex items-center gap-2 text-ui-fg-muted">
            <Text size="small">
              {totalCount > 0 ? `${startItem}-${endItem} / ${totalCount.toLocaleString()}` : "0"} kategori
            </Text>
          </div>
        </div>

        {/* Table */}
        <div className="px-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ui-border-interactive"></div>
                <Text size="small" className="text-ui-fg-subtle">
                  Yükleniyor...
                </Text>
              </div>
            </div>
          ) : brandCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <FolderSolid className="text-ui-fg-muted h-8 w-8" />
              </div>
              <Text weight="plus" className="text-ui-fg-base mb-1">
                {searchQuery ? "Sonuç bulunamadı" : "Henüz kategori yok"}
              </Text>
              <Text size="small" className="text-ui-fg-subtle mb-4 text-center max-w-sm">
                {searchQuery 
                  ? `"${searchQuery}" aramasına uygun kategori bulunamadı`
                  : "Markalarınızı organize etmek için ilk kategorinizi ekleyin"
                }
              </Text>
              {!searchQuery && (
                <Button variant="secondary" size="small" onClick={openCreateDrawer}>
                  <PlusMini />
                  Kategori Ekle
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <Table.Header>
                  <Table.Row className="bg-ui-bg-subtle">
                    <Table.HeaderCell className="pl-6">Kategori</Table.HeaderCell>
                    <Table.HeaderCell>Marka Sayısı</Table.HeaderCell>
                    <Table.HeaderCell className="w-[100px]"></Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {brandCategories.map((brandCategory) => (
                    <Table.Row 
                      key={brandCategory.id}
                      className="cursor-pointer hover:bg-ui-bg-subtle-hover transition-colors group"
                      onClick={() => handleRowClick(brandCategory)}
                    >
                      <Table.Cell className="pl-6">
                        <div className="flex items-center gap-3">
                          {brandCategory.thumbnail ? (
                            <Avatar 
                              src={brandCategory.thumbnail} 
                              fallback={brandCategory.title.charAt(0)} 
                              size="small" 
                              className="rounded-md"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                              <FolderSolid className="text-ui-fg-subtle h-4 w-4" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <Text weight="plus" size="small" className="text-ui-fg-base">
                              {brandCategory.title}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-muted font-mono">
                              {brandCategory.id}
                            </Text>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="grey" size="small">
                          {brandCategory.brand_count || 0} marka
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenu.Trigger asChild>
                              <IconButton
                                variant="transparent"
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <EllipsisHorizontal />
                              </IconButton>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content align="end">
                              <DropdownMenu.Item 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRowClick(brandCategory)
                                }}
                              >
                                <ArrowUpRightOnBox className="mr-2 h-4 w-4" />
                                Detayları Görüntüle
                              </DropdownMenu.Item>
                              <DropdownMenu.Item 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditDrawer(brandCategory)
                                }}
                              >
                                <PencilSquare className="mr-2 h-4 w-4" />
                                Düzenle
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(brandCategory)
                                }}
                                className="text-ui-fg-error"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Sil
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu>
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
                      {startItem}-{endItem} / {totalCount.toLocaleString()}
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

      {/* Create/Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editingBrandCategory ? "Brand Kategorisi Düzenle" : "Yeni Brand Kategorisi Oluştur"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-title" weight="plus">
                Kategori Başlığı <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                id="category-title"
                placeholder="Örn: Elektronik, Giyim, Spor..."
                value={categoryTitle}
                onChange={(e) => setCategoryTitle(e.target.value)}
                autoFocus
              />
              <Text size="small" className="text-ui-fg-subtle">
                Bu başlık kategori listesinde görünecektir
              </Text>
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
              <Text size="small" className="text-ui-fg-subtle">
                Kategori için küçük resim ekleyebilirsiniz
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDrawerOpen(false)}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !categoryTitle.trim()}
              >
                {saving ? "Kaydediliyor..." : (editingBrandCategory ? "Güncelle" : "Oluştur")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Brand Kategorileri",
  icon: FolderSolid,
})

export default BrandCategoriesPage

