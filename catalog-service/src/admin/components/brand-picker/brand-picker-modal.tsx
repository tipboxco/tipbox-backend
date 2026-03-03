import { useState, useCallback, useRef, useEffect } from "react"
import {
  Heading,
  Button,
  Text,
  Input,
  Badge,
  IconButton,
  Kbd,
} from "@medusajs/ui"
import {
  MagnifyingGlass,
  XMark,
  TagSolid,
  Spinner,
  CheckCircleSolid,
} from "@medusajs/icons"
import { BrandRow, type Brand } from "./brand-row"
import { ProductListSkeleton, ProductRowSkeleton } from "../skeleton"
import { backendUrl } from "../../lib/config"

type BrandsResponse = {
  brands: Brand[]
  count: number
  limit: number
  offset: number
}

type BrandPickerModalProps = {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Callback when brands are selected and confirmed */
  onConfirm: (brandIds: string[]) => Promise<void>
  /** API endpoint to fetch brands */
  fetchEndpoint?: string
  /** Title of the modal */
  title?: string
  /** Description of the modal */
  description?: string
  /** Text for the confirm button */
  confirmButtonText?: string
  /** Number of items to fetch per page */
  itemsPerPage?: number
  /** Query parameters to add to fetch request */
  additionalQueryParams?: Record<string, string>
  /** Empty state message when no brands found */
  emptyMessage?: string
  /** Empty state message when search returns no results */
  emptySearchMessage?: string
  /** Brand IDs to exclude from the list (already added brands) */
  excludedBrandIds?: string[]
}

/**
 * A reusable modal component for selecting brands
 * Features:
 * - Server-side search with Enter key
 * - Infinite scroll pagination
 * - Skeleton loading states
 * - Multi-select with visual feedback
 */
export const BrandPickerModal = ({
  open,
  onClose,
  onConfirm,
  fetchEndpoint = "/admin/brands",
  title = "Marka Seç",
  description = "Eklemek istediğiniz markaları seçin",
  confirmButtonText = "Marka Ekle",
  itemsPerPage = 50,
  additionalQueryParams = {},
  emptyMessage = "Eklenebilecek marka yok",
  emptySearchMessage = "Aramanıza uygun marka bulunamadı",
  excludedBrandIds = [],
}: BrandPickerModalProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)
  
  // State
  const [brands, setBrands] = useState<Brand[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearchQuery, setActiveSearchQuery] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Fetch brands
  const fetchBrands = useCallback(async (reset = false, searchTerm = "", currentOffset = 0) => {
    // Prevent duplicate requests
    if (isFetchingRef.current) {
      return
    }
    
    isFetchingRef.current = true
    
    if (reset) {
      setIsLoading(true)
      setBrands([])
    } else {
      setIsLoadingMore(true)
    }
    
    try {
      const newOffset = reset ? 0 : currentOffset
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: newOffset.toString(),
        include_product_count: "false",
        ...additionalQueryParams,
      })
      
      if (searchTerm) {
        params.append("q", searchTerm)
      }
      
      const response = await fetch(`${backendUrl}${fetchEndpoint}?${params}`, {
        credentials: "include"
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: BrandsResponse = await response.json()
      
      // Filter out excluded brands
      const excludedSet = new Set(excludedBrandIds)
      const filteredBrands = data.brands.filter(brand => !excludedSet.has(brand.id))
      
      if (reset) {
        setBrands(filteredBrands)
        setOffset(itemsPerPage)
      } else {
        setBrands(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(b => b.id))
          const newBrands = filteredBrands.filter(b => !existingIds.has(b.id))
          return [...prev, ...newBrands]
        })
        setOffset(prev => prev + itemsPerPage)
      }
      
      // Adjust total count based on filtered results
      const adjustedCount = excludedBrandIds.length > 0 
        ? Math.max(0, data.count - excludedBrandIds.length)
        : data.count
      setTotalCount(adjustedCount)
      
      // Check if there are more items to load
      // If we got fewer items than requested (after filtering), we might have more
      const hasMoreItems = filteredBrands.length === itemsPerPage || 
                          (filteredBrands.length < itemsPerPage && data.brands.length === itemsPerPage)
      setHasMore(hasMoreItems && filteredBrands.length > 0)
      setInitialLoadDone(true)
    } catch (error) {
      console.error("Markalar yüklenirken hata:", error)
      // On error, stop loading more
      setHasMore(false)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [fetchEndpoint, itemsPerPage, additionalQueryParams, excludedBrandIds])

  // Initial load when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("")
      setActiveSearchQuery("")
      setSelectedBrands(new Set())
      setBrands([])
      setOffset(0)
      setHasMore(true)
      setInitialLoadDone(false)
      isFetchingRef.current = false
      
      // Use a small delay to ensure state is reset before fetching
      const timeoutId = setTimeout(() => {
        fetchBrands(true, "", 0)
      }, 0)
      
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Handle search
  const handleSearch = useCallback(() => {
    setActiveSearchQuery(searchQuery)
    setOffset(0)
    fetchBrands(true, searchQuery, 0)
  }, [searchQuery, fetchBrands])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    setActiveSearchQuery("")
    setOffset(0)
    fetchBrands(true, "", 0)
  }

  // Scroll handler for infinite load
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100
    
    if (
      isNearBottom && 
      hasMore && 
      !isLoading && 
      !isLoadingMore && 
      !isFetchingRef.current &&
      initialLoadDone
    ) {
      fetchBrands(false, activeSearchQuery, offset)
    }
  }, [hasMore, isLoading, isLoadingMore, initialLoadDone, activeSearchQuery, offset, fetchBrands])

  // Selection handlers
  const toggleSelection = useCallback((brandId: string) => {
    setSelectedBrands(prev => {
      const newSet = new Set(prev)
      if (newSet.has(brandId)) {
        newSet.delete(brandId)
      } else {
        newSet.add(brandId)
      }
      return newSet
    })
  }, [])

  const clearSelection = () => setSelectedBrands(new Set())

  // Confirm handler
  const handleConfirm = async () => {
    if (selectedBrands.size === 0) return
    
    setIsConfirming(true)
    try {
      await onConfirm(Array.from(selectedBrands))
      onClose()
    } catch (error) {
      console.error("Onay işlemi sırasında hata:", error)
    } finally {
      setIsConfirming(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ui-bg-overlay"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-ui-bg-base rounded-lg shadow-elevation-modal w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
          <div>
            <Heading level="h2" className="text-ui-fg-base">{title}</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              {description}
            </Text>
          </div>
          <IconButton variant="transparent" size="small" onClick={onClose}>
            <XMark className="h-5 w-5" />
          </IconButton>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
              <Input
                placeholder="Marka adı ile ara ve Enter'a basın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-fg-muted hover:text-ui-fg-subtle"
                >
                  <XMark className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              variant="secondary" 
              size="small"
              onClick={handleSearch}
              disabled={isLoading}
            >
              <MagnifyingGlass className="h-4 w-4" />
              Ara
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <Text size="xsmall" className="text-ui-fg-muted">
              Aramak için <Kbd>Enter</Kbd> tuşuna basın
            </Text>
            {initialLoadDone && (
              <Badge color="grey" size="small">
                {totalCount.toLocaleString()} marka
                {activeSearchQuery && ` "${activeSearchQuery}" için`}
              </Badge>
            )}
          </div>
        </div>

        {/* Selection Status */}
        {selectedBrands.size > 0 && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5 bg-ui-bg-interactive border-b border-ui-border-base">
            <div className="flex items-center gap-2">
              <CheckCircleSolid className="h-4 w-4 text-ui-fg-on-color" />
              <Text size="small" weight="plus" className="text-ui-fg-on-color">
                {selectedBrands.size} marka seçildi
              </Text>
            </div>
            <Button 
              variant="transparent" 
              size="small" 
              onClick={clearSelection}
              className="text-ui-fg-on-color hover:text-ui-fg-on-color"
            >
              Temizle
            </Button>
          </div>
        )}

        {/* Brands List */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <ProductListSkeleton count={8} />
          ) : brands.length === 0 && initialLoadDone ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <TagSolid className="text-ui-fg-muted h-8 w-8" />
              </div>
              <Text weight="plus" className="text-ui-fg-base mb-1">
                {activeSearchQuery ? "Sonuç bulunamadı" : emptyMessage}
              </Text>
              <Text size="small" className="text-ui-fg-subtle text-center max-w-sm">
                {activeSearchQuery 
                  ? `"${activeSearchQuery}" ${emptySearchMessage}`
                  : emptyMessage
                }
              </Text>
            </div>
          ) : (
            <>
              {brands.map((brand) => (
                <BrandRow
                  key={brand.id}
                  brand={brand}
                  isSelected={selectedBrands.has(brand.id)}
                  onToggle={toggleSelection}
                />
              ))}
              
              {isLoadingMore && (
                <div className="flex flex-col">
                  <ProductRowSkeleton />
                  <ProductRowSkeleton />
                  <ProductRowSkeleton />
                </div>
              )}
              
              {!hasMore && brands.length > 0 && (
                <div className="flex items-center justify-center py-4 border-t border-ui-border-base">
                  <Text size="small" className="text-ui-fg-muted">Tüm markalar yüklendi</Text>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle">
          <Text size="small" className="text-ui-fg-muted">
            Aşağı kaydırarak daha fazla marka yükleyebilirsiniz
          </Text>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isConfirming || selectedBrands.size === 0}
            >
              {isConfirming ? (
                <>
                  <Spinner className="animate-spin h-4 w-4 mr-2" />
                  İşleniyor...
                </>
              ) : (
                `${selectedBrands.size || 0} ${confirmButtonText}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

