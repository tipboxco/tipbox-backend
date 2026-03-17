import { useState, useCallback, useMemo } from "react"
import {
  Drawer,
  Button,
  Text,
  Input,
  Label,
  Badge,
  Checkbox,
  Select,
  Table,
  clx,
  toast,
} from "@medusajs/ui"
import {
  MagnifyingGlass,
  Photo,
  Spinner,
  ArrowUpRightOnBox,
  CheckCircleSolid,
  EllipsisHorizontal,
  XMark,
  ArrowDownTray,
  ChevronDownMini,
} from "@medusajs/icons"
import { backendUrl } from "../../lib/config"

// ─── Types ────────────────────────────────────────────────────────────────────

export type SerpSource = "serpapi" | "serper"

export type SerpResult = {
  title: string
  price?: string
  image?: string
  link?: string
  source?: string
  rating?: number
  reviews?: number
}

export type SerpFilters = {
  gl: string
  hl: string
  num: string
  price_min: string
  price_max: string
  sort_by: string
}

export type SerpSearchDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  brandId?: string
  onImportSuccess?: () => void
  onSelect?: (results: SerpResult[]) => void
  confirmLabel?: string
  defaultSource?: SerpSource
  defaultFilters?: Partial<SerpFilters>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: SerpFilters = {
  gl: "us",
  hl: "en",
  num: "40",
  price_min: "",
  price_max: "",
  sort_by: "relevance",
}

const COUNTRY_OPTIONS = [
  { value: "us", label: "ABD (us)" },
  { value: "tr", label: "Türkiye (tr)" },
  { value: "gb", label: "İngiltere (gb)" },
  { value: "de", label: "Almanya (de)" },
  { value: "fr", label: "Fransa (fr)" },
  { value: "it", label: "İtalya (it)" },
  { value: "es", label: "İspanya (es)" },
  { value: "nl", label: "Hollanda (nl)" },
  { value: "pl", label: "Polonya (pl)" },
  { value: "se", label: "İsveç (se)" },
  { value: "au", label: "Avustralya (au)" },
  { value: "ca", label: "Kanada (ca)" },
  { value: "jp", label: "Japonya (jp)" },
  { value: "br", label: "Brezilya (br)" },
  { value: "in", label: "Hindistan (in)" },
]

const LANGUAGE_OPTIONS = [
  { value: "en", label: "İngilizce (en)" },
  { value: "tr", label: "Türkçe (tr)" },
  { value: "de", label: "Almanca (de)" },
  { value: "fr", label: "Fransızca (fr)" },
  { value: "it", label: "İtalyanca (it)" },
  { value: "es", label: "İspanyolca (es)" },
  { value: "nl", label: "Hollandaca (nl)" },
  { value: "pl", label: "Lehçe (pl)" },
  { value: "pt", label: "Portekizce (pt)" },
  { value: "sv", label: "İsveççe (sv)" },
  { value: "ja", label: "Japonca (ja)" },
]

const RESULT_COUNT_OPTIONS = [
  { value: "20", label: "20 sonuç" },
  { value: "40", label: "40 sonuç" },
  { value: "60", label: "60 sonuç" },
  { value: "100", label: "100 sonuç" },
]

const SORT_OPTIONS = [
  { value: "relevance", label: "İlgililik" },
  { value: "price_low", label: "Fiyat (artan)" },
  { value: "price_high", label: "Fiyat (azalan)" },
  { value: "rating", label: "Puan" },
  { value: "reviews", label: "Yorum sayısı" },
]

// ─── SerpTableRow ────────────────────────────────────────────────────────────

type SerpTableRowProps = {
  result: SerpResult
  index: number
  isSelected: boolean
  isImported: boolean
  onToggle: () => void
  selectable: boolean
}

const SerpTableRow = ({
  result,
  index,
  isSelected,
  isImported,
  onToggle,
  selectable,
}: SerpTableRowProps) => {
  const [imgError, setImgError] = useState(false)

  return (
    <Table.Row
      className={clx(
        "group transition-colors",
        isImported
          ? "bg-ui-bg-subtle opacity-60"
          : isSelected
            ? "bg-ui-bg-highlight hover:bg-ui-bg-highlight-hover cursor-pointer"
            : "hover:bg-ui-bg-subtle-hover cursor-pointer"
      )}
      onClick={selectable && !isImported ? onToggle : undefined}
    >
      {selectable && (
        <Table.Cell className="pl-6" onClick={(e) => e.stopPropagation()}>
          {isImported ? (
            <CheckCircleSolid className="h-4 w-4 text-ui-tag-green-icon" />
          ) : (
            <Checkbox checked={isSelected} onCheckedChange={onToggle} />
          )}
        </Table.Cell>
      )}

      {/* Index */}
      <Table.Cell>
        <Text size="xsmall" className="text-ui-fg-muted font-mono tabular-nums">
          {index + 1}
        </Text>
      </Table.Cell>

      {/* Thumbnail */}
      <Table.Cell>
        <div className="w-10 h-10 rounded-md bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center overflow-hidden flex-shrink-0">
          {result.image && !imgError ? (
            <img
              src={result.image}
              alt={result.title}
              className="w-full h-full object-contain p-0.5"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <Photo className="text-ui-fg-muted h-5 w-5" />
          )}
        </div>
      </Table.Cell>

      {/* Title + Imported badge */}
      <Table.Cell>
        <div className="flex items-center gap-2">
          <Text
            size="small"
            weight="plus"
            className={clx(
              "line-clamp-2 leading-snug",
              isImported ? "text-ui-fg-muted" : "text-ui-fg-base"
            )}
          >
            {result.title}
          </Text>
          {isImported && (
            <Badge color="green" size="small" className="shrink-0">
              İçe aktarıldı
            </Badge>
          )}
        </div>
      </Table.Cell>

      {/* Price */}
      <Table.Cell>
        {result.price ? (
          <Text size="small" weight="plus" className="text-ui-fg-interactive whitespace-nowrap">
            {result.price}
          </Text>
        ) : (
          <Text size="small" className="text-ui-fg-muted">—</Text>
        )}
      </Table.Cell>

      {/* Source */}
      <Table.Cell>
        <Text size="small" className="text-ui-fg-subtle truncate max-w-[140px]">
          {result.source || "—"}
        </Text>
      </Table.Cell>

      {/* Rating */}
      <Table.Cell>
        {result.rating !== undefined ? (
          <div className="flex flex-col">
            <Text size="small" className="text-ui-fg-subtle">
              <span className="text-amber-500">★</span> {result.rating.toFixed(1)}
            </Text>
            {result.reviews !== undefined && (
              <Text size="xsmall" className="text-ui-fg-muted">
                ({result.reviews.toLocaleString()})
              </Text>
            )}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">—</Text>
        )}
      </Table.Cell>

      {/* External link */}
      <Table.Cell onClick={(e) => e.stopPropagation()}>
        {result.link ? (
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center"
            title="Ürünü aç"
          >
            <ArrowUpRightOnBox className="h-4 w-4 text-ui-fg-muted hover:text-ui-fg-subtle" />
          </a>
        ) : null}
      </Table.Cell>
    </Table.Row>
  )
}

// ─── Import result type from backend ──────────────────────────────────────────

type ImportResult = {
  title: string
  product_id?: string
  success: boolean
  skipped?: boolean
  reason?: string
  error?: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const SerpSearchDrawer = ({
  open,
  onOpenChange,
  title = "SERP ile Ürün Ara",
  description = "Google Shopping üzerinden ürün arayın",
  brandId,
  onImportSuccess,
  onSelect,
  confirmLabel,
  defaultSource = "serpapi",
  defaultFilters,
}: SerpSearchDrawerProps) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSource, setActiveSource] = useState<SerpSource>(defaultSource)
  const [filters, setFilters] = useState<SerpFilters>({ ...DEFAULT_FILTERS, ...defaultFilters })
  const [showFilters, setShowFilters] = useState(false)

  // Result state
  const [results, setResults] = useState<SerpResult[]>([])
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState("")

  // Pagination state
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentStart, setCurrentStart] = useState(0)

  // Import tracking: links/titles of successfully imported items
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set())

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setFilter = <K extends keyof SerpFilters>(key: K, value: SerpFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const isItemImported = useCallback(
    (result: SerpResult) => {
      if (result.link && importedKeys.has(result.link)) return true
      if (result.title && importedKeys.has(`t:${result.title}`)) return true
      return false
    },
    [importedKeys]
  )

  const resetState = useCallback(() => {
    setSearchQuery("")
    setResults([])
    setSelectedIndexes(new Set())
    setHasSearched(false)
    setLastQuery("")
    setShowFilters(false)
    setFilters({ ...DEFAULT_FILTERS, ...defaultFilters })
    setActiveSource(defaultSource)
    setHasMore(false)
    setCurrentStart(0)
    setImportedKeys(new Set())
    setIsLoadingMore(false)
  }, [defaultFilters, defaultSource])

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState()
    onOpenChange(next)
  }

  // ── Build search params ────────────────────────────────────────────────────

  const buildSearchParams = useCallback(
    (q: string, startOffset: number) => {
      const params = new URLSearchParams({
        q,
        source: activeSource,
        gl: filters.gl,
        hl: filters.hl,
        num: filters.num,
      })
      if (startOffset > 0) params.set("start", startOffset.toString())
      if (filters.price_min) params.set("price_min", filters.price_min)
      if (filters.price_max) params.set("price_max", filters.price_max)
      if (filters.sort_by && filters.sort_by !== "relevance") {
        params.set("sort_by", filters.sort_by)
      }
      return params
    },
    [activeSource, filters]
  )

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) return

    setIsLoading(true)
    setHasSearched(true)
    setLastQuery(q)
    setSelectedIndexes(new Set())
    setImportedKeys(new Set())
    setCurrentStart(0)

    try {
      const params = buildSearchParams(q, 0)
      const response = await fetch(`${backendUrl}/admin/serp-search?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error("Arama Hatası", { description: data.error || "Arama sırasında hata oluştu" })
        setResults([])
        setHasMore(false)
        return
      }

      const newResults: SerpResult[] = data.results || []
      setResults(newResults)
      setCurrentStart(newResults.length)
      setHasMore(data.has_more === true || newResults.length >= parseInt(filters.num))
    } catch {
      toast.error("Bağlantı Hatası", { description: "Sunucuya bağlanılamadı" })
      setResults([])
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, buildSearchParams, filters.num])

  // ── Load More ──────────────────────────────────────────────────────────────

  const handleLoadMore = useCallback(async () => {
    const q = lastQuery.trim()
    if (!q || isLoadingMore) return

    setIsLoadingMore(true)

    try {
      const params = buildSearchParams(q, currentStart)
      const response = await fetch(`${backendUrl}/admin/serp-search?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error("Yükleme Hatası", { description: data.error || "Daha fazla sonuç yüklenemedi" })
        return
      }

      const newResults: SerpResult[] = data.results || []
      if (newResults.length === 0) {
        setHasMore(false)
        toast.success("Tamamlandı", { description: "Daha fazla sonuç bulunamadı" })
        return
      }

      setResults((prev) => [...prev, ...newResults])
      setCurrentStart((prev) => prev + newResults.length)
      setHasMore(data.has_more === true || newResults.length >= parseInt(filters.num))
    } catch {
      toast.error("Bağlantı Hatası", { description: "Sunucuya bağlanılamadı" })
    } finally {
      setIsLoadingMore(false)
    }
  }, [lastQuery, currentStart, isLoadingMore, buildSearchParams, filters.num])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleSourceChange = (source: SerpSource) => {
    setActiveSource(source)
    setResults([])
    setHasSearched(false)
    setSelectedIndexes(new Set())
    setHasMore(false)
    setCurrentStart(0)
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  // Selectable indexes: exclude imported items
  const selectableIndexes = useMemo(() => {
    const set = new Set<number>()
    results.forEach((r, i) => {
      if (!isItemImported(r)) set.add(i)
    })
    return set
  }, [results, isItemImported])

  const toggleRow = (index: number) => {
    if (!selectableIndexes.has(index)) return
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIndexes.size === selectableIndexes.size) {
      setSelectedIndexes(new Set())
    } else {
      setSelectedIndexes(new Set(selectableIndexes))
    }
  }

  // ── Primary action (import or select) ──────────────────────────────────────

  const selectedProducts = useMemo(
    () => Array.from(selectedIndexes).map((i) => results[i]),
    [selectedIndexes, results]
  )

  const handleAction = useCallback(async () => {
    if (selectedProducts.length === 0) return

    // Select mode
    if (onSelect) {
      onSelect(selectedProducts)
      setSelectedIndexes(new Set())
      return
    }

    // Import mode
    if (!brandId) return
    setIsActing(true)

    try {
      const response = await fetch(`${backendUrl}/admin/serp-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, products: selectedProducts }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error("İçe Aktarma Hatası", {
          description: data.error || "İçe aktarma sırasında hata oluştu",
        })
        return
      }

      // Mark imported items
      const importResults: ImportResult[] = data.results || []
      const newKeys = new Set(importedKeys)
      importResults.forEach((r: ImportResult, i: number) => {
        if (r.success) {
          const product = selectedProducts[i]
          if (product?.link) newKeys.add(product.link)
          if (product?.title) newKeys.add(`t:${product.title}`)
        }
      })
      setImportedKeys(newKeys)

      // Build descriptive toast
      const created = data.created ?? 0
      const skipped = data.skipped ?? 0
      const failed = data.failed ?? 0

      if (failed > 0 && created > 0) {
        toast.warning("Kısmen Başarılı", {
          description: `${created} ürün aktarıldı, ${skipped > 0 ? `${skipped} atlandı, ` : ""}${failed} başarısız`,
        })
      } else if (failed > 0 && created === 0) {
        toast.error("İçe Aktarma Başarısız", {
          description: `${failed} ürün aktarılamadı${skipped > 0 ? `, ${skipped} zaten mevcut` : ""}`,
        })
      } else {
        toast.success("Başarılı", {
          description: `${created} ürün markaya eklendi${skipped > 0 ? `, ${skipped} zaten mevcut` : ""}`,
        })
      }

      // Clear selection (keep results visible, imported items marked)
      setSelectedIndexes(new Set())
      onImportSuccess?.()
    } catch {
      toast.error("Bağlantı Hatası", { description: "Sunucuya bağlanılamadı" })
    } finally {
      setIsActing(false)
    }
  }, [selectedProducts, onSelect, brandId, importedKeys, onImportSuccess])

  // ── Derived state ──────────────────────────────────────────────────────────

  const actionLabel = useMemo(() => {
    if (confirmLabel) return confirmLabel
    const count = selectedIndexes.size
    if (onSelect) return count > 0 ? `${count} Ürünü Seç` : "Ürünü Seç"
    if (brandId) return count > 0 ? `${count} Ürünü Import Et` : "Import Et"
    return undefined
  }, [confirmLabel, selectedIndexes.size, onSelect, brandId])

  const hasAction = Boolean(onSelect || brandId)
  const allSelectable = selectableIndexes.size
  const allSelected = allSelectable > 0 && selectedIndexes.size === allSelectable
  const importedCount = useMemo(
    () => results.filter((r) => isItemImported(r)).length,
    [results, isItemImported]
  )

  // Active filter count
  const activeFilterCount = [
    filters.gl !== "us",
    filters.hl !== "en",
    filters.num !== "40",
    filters.price_min !== "",
    filters.price_max !== "",
    filters.sort_by !== "relevance",
  ].filter(Boolean).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Drawer.Content
        className="flex flex-col rounded-none"
        style={{ maxWidth: "100vw", width: "100vw", inset: 0 }}
      >
        {/* ── Header ── */}
        <Drawer.Header className="flex-shrink-0">
          <div className="flex items-start justify-between w-full">
            <div>
              <Drawer.Title>{title}</Drawer.Title>
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                {description}
              </Text>
            </div>
            {/* Quick stats when results exist */}
            {hasSearched && !isLoading && results.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge color="grey" size="small">
                  {results.length} sonuç
                </Badge>
                {importedCount > 0 && (
                  <Badge color="green" size="small">
                    {importedCount} aktarıldı
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-0 p-0 min-h-0 overflow-hidden">
          {/* ── Source + Search bar ── */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle space-y-3">
            {/* Source toggle */}
            <div className="flex items-center gap-2">
              <Text size="xsmall" className="text-ui-fg-muted font-medium">
                Kaynak:
              </Text>
              <button
                type="button"
                onClick={() => handleSourceChange("serpapi")}
                className={clx(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                  activeSource === "serpapi"
                    ? "bg-ui-bg-interactive text-ui-fg-on-color border-transparent"
                    : "bg-ui-bg-base text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base-hover"
                )}
              >
                SerpAPI
              </button>
              <button
                type="button"
                onClick={() => handleSourceChange("serper")}
                className={clx(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                  activeSource === "serper"
                    ? "bg-ui-bg-interactive text-ui-fg-on-color border-transparent"
                    : "bg-ui-bg-base text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base-hover"
                )}
              >
                Serper.dev
              </button>
            </div>

            {/* Search input row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                <Input
                  placeholder='Ürün adı ara... (örn. "macbook", "brand:apple iphone")'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  autoFocus
                />
              </div>

              {/* Filter toggle */}
              <Button
                variant={showFilters ? "primary" : "secondary"}
                size="base"
                onClick={() => setShowFilters((v) => !v)}
                title="Filtreleri göster / gizle"
              >
                <EllipsisHorizontal className="h-4 w-4" />
                Filtrele
                {activeFilterCount > 0 && (
                  <Badge color="blue" size="small" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="primary"
                size="base"
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
              >
                {isLoading ? (
                  <>
                    <Spinner className="animate-spin h-4 w-4" />
                    Aranıyor
                  </>
                ) : (
                  <>
                    <MagnifyingGlass className="h-4 w-4" />
                    Ara
                  </>
                )}
              </Button>
            </div>

            {/* Search info */}
            {hasSearched && !isLoading && (
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-muted">
                  &ldquo;{lastQuery}&rdquo; &middot;{" "}
                  <span className="font-medium">
                    {activeSource === "serpapi" ? "SerpAPI" : "Serper.dev"}
                  </span>
                </Text>
              </div>
            )}
          </div>

          {/* ── Filter panel (collapsible) ── */}
          {showFilters && (
            <div className="flex-shrink-0 px-6 py-4 border-b border-ui-border-base bg-ui-bg-base">
              <div className="flex items-center justify-between mb-3">
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  Filtreler
                </Text>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS, ...defaultFilters })}
                    className="flex items-center gap-1 text-xs text-ui-fg-muted hover:text-ui-fg-subtle"
                  >
                    <XMark className="h-3 w-3" />
                    Sıfırla
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {/* Country */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">Ülke</Label>
                  <Select value={filters.gl} onValueChange={(v) => setFilter("gl", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      {COUNTRY_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Language */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">Dil</Label>
                  <Select value={filters.hl} onValueChange={(v) => setFilter("hl", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      {LANGUAGE_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Result count */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">Sonuç Sayısı</Label>
                  <Select value={filters.num} onValueChange={(v) => setFilter("num", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      {RESULT_COUNT_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Sort */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">Sıralama</Label>
                  <Select value={filters.sort_by} onValueChange={(v) => setFilter("sort_by", v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      {SORT_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Price min */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Min Fiyat{" "}
                    {activeSource === "serper" && (
                      <span className="text-ui-fg-muted">(SerpAPI only)</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="örn. 100"
                    value={filters.price_min}
                    onChange={(e) => setFilter("price_min", e.target.value)}
                    disabled={activeSource === "serper"}
                    size="small"
                  />
                </div>

                {/* Price max */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Max Fiyat{" "}
                    {activeSource === "serper" && (
                      <span className="text-ui-fg-muted">(SerpAPI only)</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="örn. 2000"
                    value={filters.price_max}
                    onChange={(e) => setFilter("price_max", e.target.value)}
                    disabled={activeSource === "serper"}
                    size="small"
                  />
                </div>
              </div>

              <Text size="xsmall" className="text-ui-fg-muted mt-3">
                Arama sorgusuna Google operatörleri ekleyebilirsiniz: <code>brand:apple</code>,{" "}
                <code>inurl:apple.com</code> vb.
              </Text>
            </div>
          )}

          {/* ── Selection status bar ── */}
          {selectedIndexes.size > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5 bg-ui-bg-interactive border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <CheckCircleSolid className="h-4 w-4 text-ui-fg-on-color" />
                <Text size="small" weight="plus" className="text-ui-fg-on-color">
                  {selectedIndexes.size} ürün seçildi
                </Text>
              </div>
              <Button
                variant="transparent"
                size="small"
                onClick={() => setSelectedIndexes(new Set())}
                className="text-ui-fg-on-color hover:text-ui-fg-on-color"
              >
                Temizle
              </Button>
            </div>
          )}

          {/* ── Table / empty states ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48">
                <Spinner className="animate-spin h-8 w-8 text-ui-fg-interactive mb-3" />
                <Text size="small" className="text-ui-fg-subtle">
                  Aranıyor...
                </Text>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <MagnifyingGlass className="text-ui-fg-muted h-8 w-8" />
                <Text weight="plus" className="text-ui-fg-base">
                  Arama yapın
                </Text>
                <Text size="small" className="text-ui-fg-subtle text-center max-w-xs">
                  Bir ürün adı veya anahtar kelime girin ve Enter&apos;a basın
                </Text>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <MagnifyingGlass className="text-ui-fg-muted h-8 w-8" />
                <Text weight="plus" className="text-ui-fg-base">
                  Sonuç bulunamadı
                </Text>
                <Text size="small" className="text-ui-fg-subtle text-center max-w-xs">
                  &ldquo;{lastQuery}&rdquo; için sonuç yok. Farklı filtre veya kelime deneyin.
                </Text>
              </div>
            ) : (
              <>
                <Table>
                  <Table.Header>
                    <Table.Row className="bg-ui-bg-subtle">
                      {hasAction && (
                        <Table.HeaderCell className="w-[48px] pl-6">
                          <Checkbox
                            checked={allSelected ? true : selectedIndexes.size > 0 ? "indeterminate" : false}
                            onCheckedChange={toggleAll}
                          />
                        </Table.HeaderCell>
                      )}
                      <Table.HeaderCell className="w-[44px]">#</Table.HeaderCell>
                      <Table.HeaderCell className="w-[56px]">Görsel</Table.HeaderCell>
                      <Table.HeaderCell>Ürün Adı</Table.HeaderCell>
                      <Table.HeaderCell className="w-[110px]">Fiyat</Table.HeaderCell>
                      <Table.HeaderCell className="w-[140px]">Kaynak</Table.HeaderCell>
                      <Table.HeaderCell className="w-[90px]">Puan</Table.HeaderCell>
                      <Table.HeaderCell className="w-[52px]" />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {results.map((result, index) => (
                      <SerpTableRow
                        key={`${result.link || result.title}-${index}`}
                        result={result}
                        index={index}
                        isSelected={selectedIndexes.has(index)}
                        isImported={isItemImported(result)}
                        onToggle={() => toggleRow(index)}
                        selectable={hasAction}
                      />
                    ))}
                  </Table.Body>
                </Table>

                {/* Load More button */}
                {hasMore && (
                  <div className="flex items-center justify-center py-4 border-t border-ui-border-base">
                    <Button
                      variant="secondary"
                      size="base"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Spinner className="animate-spin h-4 w-4" />
                          Yükleniyor...
                        </>
                      ) : (
                        <>
                          <ChevronDownMini className="h-4 w-4" />
                          Daha Fazla Yükle
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* End of results message */}
                {!hasMore && results.length > 0 && hasSearched && (
                  <div className="flex items-center justify-center py-3 border-t border-ui-border-base">
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Tüm sonuçlar yüklendi ({results.length} ürün)
                    </Text>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle">
            <Text size="xsmall" className="text-ui-fg-muted">
              {activeSource === "serpapi"
                ? "SerpAPI · Google Shopping"
                : "Serper.dev · Google Shopping"}
            </Text>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                {importedCount > 0 ? "Kapat" : "İptal"}
              </Button>
              {hasAction && actionLabel && (
                <Button
                  variant="primary"
                  onClick={handleAction}
                  disabled={selectedIndexes.size === 0 || isActing}
                >
                  {isActing ? (
                    <>
                      <Spinner className="animate-spin h-4 w-4" />
                      İçe aktarılıyor...
                    </>
                  ) : (
                    <>
                      <ArrowDownTray className="h-4 w-4" />
                      {actionLabel}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
