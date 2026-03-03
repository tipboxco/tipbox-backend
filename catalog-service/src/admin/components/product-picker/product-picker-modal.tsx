import { useState, useCallback, useRef, useEffect } from "react"
import {
  Heading,
  Button,
  Text,
  Input,
  Badge,
  IconButton,
  Kbd,
  clx,
} from "@medusajs/ui"
import {
  MagnifyingGlass,
  XMark,
  ShoppingBag,
  Spinner,
  CheckCircleSolid,
} from "@medusajs/icons"
import { ProductRow, type Product } from "./product-row"
import { ProductListSkeleton, ProductRowSkeleton } from "../skeleton"
import { backendUrl } from "../../lib/config"

type ProductsResponse = {
  products: Product[]
  count: number
  limit: number
  offset: number
}

type ProductPickerModalProps = {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Callback when products are selected and confirmed */
  onConfirm: (productIds: string[]) => Promise<void>
  /** API endpoint to fetch products */
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
  /** Empty state message when no products found */
  emptyMessage?: string
  /** Empty state message when search returns no results */
  emptySearchMessage?: string
}

/**
 * A reusable modal component for selecting products
 * Features:
 * - Server-side search with Enter key
 * - Infinite scroll pagination
 * - Skeleton loading states
 * - Multi-select with visual feedback
 */
export const ProductPickerModal = ({
  open,
  onClose,
  onConfirm,
  fetchEndpoint = "/admin/products",
  title = "Ürün Seç",
  description = "Eklemek istediğiniz ürünleri seçin",
  confirmButtonText = "Ürün Ekle",
  itemsPerPage = 50,
  additionalQueryParams = {},
  emptyMessage = "Eklenebilecek ürün yok",
  emptySearchMessage = "Aramanıza uygun ürün bulunamadı",
}: ProductPickerModalProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // State
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearchQuery, setActiveSearchQuery] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Fetch products
  const fetchProducts = useCallback(async (reset = false, searchTerm = "", currentOffset = 0) => {
    if (reset) {
      setIsLoading(true)
      setProducts([])
    } else {
      setIsLoadingMore(true)
    }
    
    try {
      const newOffset = reset ? 0 : currentOffset
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: newOffset.toString(),
        ...additionalQueryParams,
      })
      
      if (searchTerm) {
        params.append("q", searchTerm)
      }
      
      const response = await fetch(`${backendUrl}${fetchEndpoint}?${params}`, {
        credentials: "include"
      })
      const data: ProductsResponse = await response.json()
      
      if (reset) {
        setProducts(data.products)
        setOffset(itemsPerPage)
      } else {
        setProducts(prev => [...prev, ...data.products])
        setOffset(prev => prev + itemsPerPage)
      }
      
      setTotalCount(data.count)
      setHasMore(data.products.length === itemsPerPage)
      setInitialLoadDone(true)
    } catch (error) {
      console.error("Ürünler yüklenirken hata:", error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [fetchEndpoint, itemsPerPage, additionalQueryParams])

  // Initial load when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("")
      setActiveSearchQuery("")
      setSelectedProducts(new Set())
      setProducts([])
      setOffset(0)
      setHasMore(true)
      setInitialLoadDone(false)
      fetchProducts(true, "", 0)
    }
  }, [open, fetchProducts])

  // Handle search
  const handleSearch = useCallback(() => {
    setActiveSearchQuery(searchQuery)
    setOffset(0)
    fetchProducts(true, searchQuery, 0)
  }, [searchQuery, fetchProducts])

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
    fetchProducts(true, "", 0)
  }

  // Scroll handler for infinite load
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (
      scrollHeight - scrollTop <= clientHeight + 100 && 
      hasMore && 
      !isLoading && 
      !isLoadingMore && 
      initialLoadDone
    ) {
      fetchProducts(false, activeSearchQuery, offset)
    }
  }, [hasMore, isLoading, isLoadingMore, initialLoadDone, fetchProducts, activeSearchQuery, offset])

  // Selection handlers
  const toggleSelection = useCallback((productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }, [])

  const clearSelection = () => setSelectedProducts(new Set())

  // Confirm handler
  const handleConfirm = async () => {
    if (selectedProducts.size === 0) return
    
    setIsConfirming(true)
    try {
      await onConfirm(Array.from(selectedProducts))
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
                placeholder="Ürün adı ile ara ve Enter'a basın..."
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
                {totalCount.toLocaleString()} ürün
                {activeSearchQuery && ` "${activeSearchQuery}" için`}
              </Badge>
            )}
          </div>
        </div>

        {/* Selection Status */}
        {selectedProducts.size > 0 && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5 bg-ui-bg-interactive border-b border-ui-border-base">
            <div className="flex items-center gap-2">
              <CheckCircleSolid className="h-4 w-4 text-ui-fg-on-color" />
              <Text size="small" weight="plus" className="text-ui-fg-on-color">
                {selectedProducts.size} ürün seçildi
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

        {/* Products List */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <ProductListSkeleton count={8} />
          ) : products.length === 0 && initialLoadDone ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <ShoppingBag className="text-ui-fg-muted h-8 w-8" />
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
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isSelected={selectedProducts.has(product.id)}
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
              
              {!hasMore && products.length > 0 && (
                <div className="flex items-center justify-center py-4 border-t border-ui-border-base">
                  <Text size="small" className="text-ui-fg-muted">Tüm ürünler yüklendi</Text>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle">
          <Text size="small" className="text-ui-fg-muted">
            Aşağı kaydırarak daha fazla ürün yükleyebilirsiniz
          </Text>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isConfirming || selectedProducts.size === 0}
            >
              {isConfirming ? (
                <>
                  <Spinner className="animate-spin h-4 w-4 mr-2" />
                  İşleniyor...
                </>
              ) : (
                `${selectedProducts.size || 0} ${confirmButtonText}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

