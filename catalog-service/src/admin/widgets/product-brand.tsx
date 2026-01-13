import { useEffect, useState, useRef, useCallback } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { 
  Container, 
  Text, 
  Badge,
  IconButton,
  toast,
  Input,
  clx,
} from "@medusajs/ui"
import { 
  TagSolid, 
  PencilSquare, 
  XMark, 
  Spinner,
  MagnifyingGlass,
  ChevronDownMini,
} from "@medusajs/icons"

type Brand = {
  id: string
  name: string
}

type BrandsResponse = {
  brands: Brand[]
  count: number
  limit: number
  offset: number
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

const ProductBrandWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [brands, setBrands] = useState<Brand[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [totalBrands, setTotalBrands] = useState(0)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Initial load - sadece current brand'i getir
  useEffect(() => {
    const fetchCurrentBrand = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/admin/products/${data.id}/brand`, { 
          credentials: "include" 
        })
        const brandData = await response.json()
        
        if (brandData.brand) {
          setCurrentBrand(brandData.brand)
        }
      } catch (error) {
        console.error("Brand yüklenirken hata:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentBrand()
  }, [data.id])

  // Search brands
  const searchBrands = useCallback(async (query: string) => {
    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        limit: "20",
        offset: "0",
        include_product_count: "false",
      })
      
      if (query) {
        params.append("q", query)
      }
      
      const response = await fetch(`/admin/brands?${params}`, { 
        credentials: "include" 
      })
      const data: BrandsResponse = await response.json()
      
      setBrands(data.brands)
      setTotalBrands(data.count)
    } catch (error) {
      console.error("Brands aranırken hata:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    if (isEditing) {
      searchBrands(debouncedSearch)
    }
  }, [debouncedSearch, isEditing, searchBrands])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSave = async (brand: Brand) => {
    setSaving(true)
    try {
      const response = await fetch(`/admin/products/${data.id}/brand`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id }),
      })

      if (response.ok) {
        setCurrentBrand(brand)
        setIsEditing(false)
        setShowDropdown(false)
        setSearchQuery("")
        toast.success("Marka güncellendi")
      } else {
        const error = await response.json()
        toast.error(error.message || "Marka güncellenirken hata oluştu")
      }
    } catch (error) {
      toast.error("Marka güncellenirken hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/admin/products/${data.id}/brand`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        setCurrentBrand(null)
        setIsEditing(false)
        setSearchQuery("")
        toast.success("Marka kaldırıldı")
      } else {
        toast.error("Marka kaldırılırken hata oluştu")
      }
    } catch (error) {
      toast.error("Marka kaldırılırken hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setSearchQuery("")
    setIsEditing(true)
    setShowDropdown(true)
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setShowDropdown(false)
    setSearchQuery("")
  }

  // Loading skeleton
  if (loading) {
    return (
      <Container className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <TagSolid className="h-4 w-4 text-ui-fg-muted" />
            <Text size="small" weight="plus" className="text-ui-fg-base">Marka</Text>
          </div>
          <div className="h-5 w-20 bg-ui-bg-component rounded animate-pulse" />
        </div>
      </Container>
    )
  }

  // Marka yoksa ve düzenleme modunda değilse
  if (!currentBrand && !isEditing) {
    return (
      <Container className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <TagSolid className="h-4 w-4 text-ui-fg-muted" />
            <Text size="small" weight="plus" className="text-ui-fg-base">Marka</Text>
          </div>
          <button
            onClick={startEditing}
            className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover text-sm font-medium transition-colors"
          >
            + Ekle
          </button>
        </div>
      </Container>
    )
  }

  // Düzenleme modu
  if (isEditing) {
    return (
      <Container className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ui-border-base">
          <div className="flex items-center gap-2">
            <TagSolid className="h-4 w-4 text-ui-fg-muted" />
            <Text size="small" weight="plus" className="text-ui-fg-base">Marka</Text>
          </div>
          <div className="flex items-center gap-1">
            {saving && (
              <Spinner className="h-4 w-4 animate-spin text-ui-fg-muted" />
            )}
            <IconButton 
              variant="transparent" 
              size="small"
              onClick={cancelEditing}
              disabled={saving}
            >
              <XMark className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <div className="px-4 py-3" ref={dropdownRef}>
          {/* Search Input */}
          <div className="relative">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ui-fg-muted" />
              <Input
                ref={inputRef}
                placeholder="Marka ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className="pl-9 pr-8"
                size="small"
              />
              {isSearching ? (
                <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-ui-fg-muted" />
              ) : (
                <ChevronDownMini 
                  className={clx(
                    "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ui-fg-muted transition-transform",
                    showDropdown && "rotate-180"
                  )} 
                />
              )}
            </div>
            
            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-ui-bg-base border border-ui-border-base rounded-lg shadow-elevation-flyout max-h-[200px] overflow-y-auto">
                {brands.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <Text size="small" className="text-ui-fg-muted">
                      {isSearching ? "Aranıyor..." : (searchQuery ? "Sonuç bulunamadı" : "Marka bulunamadı")}
                    </Text>
                  </div>
                ) : (
                  <>
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() => handleSave(brand)}
                        disabled={saving}
                        className={clx(
                          "w-full px-3 py-2 text-left text-sm transition-colors",
                          "hover:bg-ui-bg-base-hover",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          currentBrand?.id === brand.id && "bg-ui-bg-base-pressed"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Text size="small" className="text-ui-fg-base">
                            {brand.name}
                          </Text>
                          {currentBrand?.id === brand.id && (
                            <Badge color="green" size="xsmall">Mevcut</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                    {totalBrands > brands.length && (
                      <div className="px-3 py-2 border-t border-ui-border-base">
                        <Text size="xsmall" className="text-ui-fg-muted">
                          +{totalBrands - brands.length} daha fazla sonuç için aramayı daraltın
                        </Text>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Remove button */}
          {currentBrand && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="mt-2 text-ui-fg-error hover:text-ui-fg-error text-xs font-medium transition-colors disabled:opacity-50"
            >
              Markayı Kaldır
            </button>
          )}
        </div>
      </Container>
    )
  }

  // Normal görünüm - marka atanmış
  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <TagSolid className="h-4 w-4 text-ui-fg-muted" />
          <Text size="small" weight="plus" className="text-ui-fg-base">Marka</Text>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="purple" size="small">
            {currentBrand?.name}
          </Badge>
          <IconButton 
            variant="transparent" 
            size="small"
            onClick={startEditing}
          >
            <PencilSquare className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductBrandWidget
