import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Table, 
  Button, 
  Text, 
  Input,
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
  TagSolid, 
  PlusMini, 
  EllipsisHorizontal,
  PencilSquare, 
  Trash,
  MagnifyingGlass,
  ArrowUpRightOnBox,
  ChevronLeftMini,
  ChevronRightMini,
} from "@medusajs/icons"

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
  product_count?: number
  created_at?: string
  updated_at?: string
}

type BrandsResponse = {
  brands: Brand[]
  count: number
  limit: number
  offset: number
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const BrandsPage = () => {
  const navigate = useNavigate()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const activeFetchRef = useRef<{ requestId: number; controller: AbortController } | null>(null)
  const requestIdRef = useRef(0)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  
  const prompt = usePrompt()

  const fetchBrands = useCallback(async (page: number = 1, limit: number = itemsPerPage, search: string = "") => {
    setLoading(true)
    try {
      const offset = (page - 1) * limit
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        include_product_count: "true",
      })
      
      if (search) {
        params.append("q", search)
      }
      
      // Cancel any in-flight request to avoid stale results overwriting UI
      if (activeFetchRef.current) {
        activeFetchRef.current.controller.abort()
      }
      const controller = new AbortController()
      const requestId = ++requestIdRef.current
      activeFetchRef.current = { requestId, controller }

      const response = await fetch(`/admin/brands?${params}`, {
        credentials: "include",
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`Brands fetch failed: ${response.status}`)
      }
      const data: BrandsResponse = await response.json()
      
      // Only apply the latest response (prevents race conditions)
      if (activeFetchRef.current?.requestId !== requestId) {
        return
      }

      setBrands(data.brands || [])
      setTotalCount(data.count || 0)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      console.error("Markalar yüklenirken hata:", error)
      toast.error("Hata", {
        description: "Markalar yüklenirken bir hata oluştu",
      })
    } finally {
      // Avoid flipping loading=false for a request that is no longer the latest
      const isLatest = activeFetchRef.current?.requestId === requestIdRef.current
      if (isLatest) {
        setLoading(false)
      }
    }
  }, [itemsPerPage])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  useEffect(() => {
    fetchBrands(currentPage, itemsPerPage, debouncedSearchQuery)
  }, [currentPage, itemsPerPage, debouncedSearchQuery, fetchBrands])


  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)




  const handleDelete = async (brand: Brand) => {
    const confirmed = await prompt({
      title: "Markayı Sil",
      description: `"${brand.name}" markasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      cancelText: "İptal",
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/admin/brands/${brand.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast.success("Başarılı", {
          description: "Marka başarıyla silindi",
        })
        // Eğer son sayfada tek item varsa ve silindiyse, önceki sayfaya git
        if (brands.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1)
        } else {
          fetchBrands(currentPage, itemsPerPage, searchQuery)
        }
      }
    } catch (error) {
      console.error("Marka silinirken hata:", error)
      toast.error("Hata", {
        description: "Marka silinirken bir hata oluştu",
      })
    }
  }

  const handleRowClick = (brand: Brand) => {
    navigate(`/brands/${brand.id}`)
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
              Markalar
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Ürünlerinize marka atayarak koleksiyonlarınızı organize edin
            </Text>
          </div>
          <Button variant="primary" size="small" onClick={() => navigate("/brands/new")}>
            <PlusMini />
            Marka Ekle
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
              placeholder="Marka ara..."
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value
                setSearchQuery(next)
                // Always search from page 1 to avoid "random-looking" results
                if (currentPage !== 1) {
                  setCurrentPage(1)
                }
              }}
              className="pl-10"
              size="small"
            />
          </div>
          <div className="flex items-center gap-2 text-ui-fg-muted">
            <Text size="small">
              {totalCount > 0 ? `${startItem}-${endItem} / ${totalCount.toLocaleString()}` : "0"} marka
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
          ) : brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <TagSolid className="text-ui-fg-muted h-8 w-8" />
              </div>
              <Text weight="plus" className="text-ui-fg-base mb-1">
                {searchQuery ? "Sonuç bulunamadı" : "Henüz marka yok"}
              </Text>
              <Text size="small" className="text-ui-fg-subtle mb-4 text-center max-w-sm">
                {searchQuery 
                  ? `"${searchQuery}" aramasına uygun marka bulunamadı`
                  : "Ürünlerinizi organize etmek için ilk markanızı ekleyin"
                }
              </Text>
              {!searchQuery && (
                <Button variant="secondary" size="small" onClick={() => navigate("/brands/new")}>
                  <PlusMini />
                  Marka Ekle
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <Table.Header>
                  <Table.Row className="bg-ui-bg-subtle">
                    <Table.HeaderCell className="pl-6">Marka</Table.HeaderCell>
                    <Table.HeaderCell>Kategori</Table.HeaderCell>
                    <Table.HeaderCell>Ürün Sayısı</Table.HeaderCell>
                    <Table.HeaderCell className="w-[100px]"></Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {brands.map((brand) => (
                    <Table.Row 
                      key={brand.id}
                      className="cursor-pointer hover:bg-ui-bg-subtle-hover transition-colors group"
                      onClick={() => handleRowClick(brand)}
                    >
                      <Table.Cell className="pl-6">
                        <div className="flex items-center gap-3">
                          {brand.logo_url ? (
                            <Avatar 
                              src={brand.logo_url} 
                              fallback={brand.name.charAt(0)} 
                              size="small" 
                              className="rounded-md"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                              <TagSolid className="text-ui-fg-subtle h-4 w-4" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <Text weight="plus" size="small" className="text-ui-fg-base">
                              {brand.name}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-muted font-mono">
                              {brand.id}
                            </Text>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {brand.category ? (
                          <Badge color="blue" size="small">
                            {brand.category.title}
                          </Badge>
                        ) : (
                          <Text size="small" className="text-ui-fg-muted">
                            Kategori yok
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="grey" size="small">
                          {brand.product_count || 0} ürün
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
                                  handleRowClick(brand)
                                }}
                              >
                                <ArrowUpRightOnBox className="mr-2 h-4 w-4" />
                                Detayları Görüntüle
                              </DropdownMenu.Item>
                              <DropdownMenu.Item 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/brands/${brand.id}/edit`)
                                }}
                              >
                                <PencilSquare className="mr-2 h-4 w-4" />
                                Düzenle
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(brand)
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

    </div>
  )
}

export const config = defineRouteConfig({
  label: "Markalar",
  icon: TagSolid,
})

export default BrandsPage
