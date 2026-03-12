import { useState, useCallback } from "react"
import {
  Drawer,
  Heading,
  Button,
  Text,
  Input,
  Label,
  Badge,
  IconButton,
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
  gl: string       // country code
  hl: string       // language code
  num: string      // result count
  price_min: string
  price_max: string
  sort_by: string  // "relevance" | "price_low" | "price_high" | "rating" | "reviews"
}

/**
 * Props for SerpSearchDrawer.
 *
 * Import mode  → provide `brandId` (+ optional `onImportSuccess`)
 * Select mode  → provide `onSelect` to receive selected results externally
 * Browse mode  → neither; drawer is read-only with external links
 */
export type SerpSearchDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Title shown in drawer header */
  title?: string
  /** Subtitle shown below title */
  description?: string
  /** If provided, enables "Import Et" button that creates Medusa products */
  brandId?: string
  /** Called after a successful import */
  onImportSuccess?: () => void
  /** If provided, enables "Seç" button that returns selected results to the caller */
  onSelect?: (results: SerpResult[]) => void
  /** Label on the primary action button (auto-derived when not set) */
  confirmLabel?: string
  /** Default source tab on open */
  defaultSource?: SerpSource
  /** Default filter values */
  defaultFilters?: Partial<SerpFilters>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: SerpFilters = {
  gl: "us",
  hl: "en",
  num: "20",
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
  { value: "10", label: "10 sonuç" },
  { value: "20", label: "20 sonuç" },
  { value: "40", label: "40 sonuç" },
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
  isSelected: boolean
  onToggle: () => void
  selectable: boolean
}

const SerpTableRow = ({ result, isSelected, onToggle, selectable }: SerpTableRowProps) => {
  const [imgError, setImgError] = useState(false)

  return (
    <Table.Row
      className={clx(
        "group cursor-pointer hover:bg-ui-bg-subtle-hover",
        isSelected && "bg-ui-bg-highlight hover:bg-ui-bg-highlight-hover"
      )}
      onClick={selectable ? onToggle : undefined}
    >
      {selectable && (
        <Table.Cell className="pl-6" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggle} />
        </Table.Cell>
      )}

      {/* Thumbnail */}
      <Table.Cell>
        <div className="w-10 h-10 rounded-md bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center overflow-hidden flex-shrink-0">
          {result.image && !imgError ? (
            <img
              src={result.image}
              alt={result.title}
              className="w-full h-full object-contain p-0.5"
              onError={() => setImgError(true)}
            />
          ) : (
            <Photo className="text-ui-fg-muted h-5 w-5" />
          )}
        </div>
      </Table.Cell>

      {/* Title */}
      <Table.Cell>
        <Text size="small" weight="plus" className="text-ui-fg-base line-clamp-2 leading-snug">
          {result.title}
        </Text>
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
            <Text size="small" className="text-ui-fg-subtle">★ {result.rating.toFixed(1)}</Text>
            {result.reviews !== undefined && (
              <Text size="xsmall" className="text-ui-fg-muted">({result.reviews.toLocaleString()})</Text>
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setFilter = <K extends keyof SerpFilters>(key: K, value: SerpFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetState = useCallback(() => {
    setSearchQuery("")
    setResults([])
    setSelectedIndexes(new Set())
    setHasSearched(false)
    setLastQuery("")
    setShowFilters(false)
    setFilters({ ...DEFAULT_FILTERS, ...defaultFilters })
    setActiveSource(defaultSource)
  }, [defaultFilters, defaultSource])

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState()
    onOpenChange(next)
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) return

    setIsLoading(true)
    setHasSearched(true)
    setLastQuery(q)
    setSelectedIndexes(new Set())

    try {
      const params = new URLSearchParams({
        q,
        source: activeSource,
        gl: filters.gl,
        hl: filters.hl,
        num: filters.num,
      })
      if (filters.price_min) params.set("price_min", filters.price_min)
      if (filters.price_max) params.set("price_max", filters.price_max)
      if (filters.sort_by && filters.sort_by !== "relevance") {
        params.set("sort_by", filters.sort_by)
      }

      const response = await fetch(`${backendUrl}/admin/serp-search?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error("Arama Hatası", { description: data.error || "Arama sırasında hata oluştu" })
        setResults([])
        return
      }

      setResults(data.results || [])
    } catch {
      toast.error("Bağlantı Hatası", { description: "Sunucuya bağlanılamadı" })
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, activeSource, filters])

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
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleRow = (index: number) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIndexes(
      selectedIndexes.size === results.length
        ? new Set()
        : new Set(results.map((_, i) => i))
    )
  }

  // ── Primary action (import or select) ────────────────────────────────────────

  const selectedProducts = Array.from(selectedIndexes).map((i) => results[i])

  const handleAction = async () => {
    if (selectedProducts.length === 0) return

    // Select mode: return results to caller
    if (onSelect) {
      onSelect(selectedProducts)
      setSelectedIndexes(new Set())
      return
    }

    // Import mode: create Medusa products + link to brand
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

      if (data.failed > 0) {
        toast.warning("Kısmen Başarılı", {
          description: `${data.successful} ürün aktarıldı, ${data.failed} başarısız`,
        })
      } else {
        toast.success("Başarılı", {
          description: `${data.successful} ürün markaya eklendi`,
        })
      }

      setSelectedIndexes(new Set())
      onImportSuccess?.()
    } catch {
      toast.error("Bağlantı Hatası", { description: "Sunucuya bağlanılamadı" })
    } finally {
      setIsActing(false)
    }
  }

  // Resolve button label
  const actionLabel = (() => {
    if (confirmLabel) return confirmLabel
    const count = selectedIndexes.size
    if (onSelect) return count > 0 ? `${count} Ürünü Seç` : "Ürünü Seç"
    if (brandId) return count > 0 ? `${count} Ürünü Import Et` : "Import Et"
    return undefined
  })()

  const hasAction = Boolean(onSelect || brandId)
  const allSelected = results.length > 0 && selectedIndexes.size === results.length
  const someSelected = selectedIndexes.size > 0 && selectedIndexes.size < results.length

  // Active filter count (excluding defaults)
  const activeFilterCount = [
    filters.gl !== "us",
    filters.hl !== "en",
    filters.num !== "20",
    filters.price_min !== "",
    filters.price_max !== "",
    filters.sort_by !== "relevance",
  ].filter(Boolean).length

  // ── Render ───────────────────────────────────────────────────────────────────

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

              {/* Filter toggle button */}
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

            {/* Result summary */}
            {hasSearched && !isLoading && (
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-muted">
                  &ldquo;{lastQuery}&rdquo; ·{" "}
                  <span className="font-medium">
                    {activeSource === "serpapi" ? "SerpAPI" : "Serper.dev"}
                  </span>
                </Text>
                <Badge color="grey" size="small">
                  {results.length} sonuç
                </Badge>
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
                    onClick={() =>
                      setFilters({ ...DEFAULT_FILTERS, ...defaultFilters })
                    }
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
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Ülke
                  </Label>
                  <Select value={filters.gl} onValueChange={(v) => setFilter("gl", v)}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {COUNTRY_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Language */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Dil
                  </Label>
                  <Select value={filters.hl} onValueChange={(v) => setFilter("hl", v)}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {LANGUAGE_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Result count */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Sonuç Sayısı
                  </Label>
                  <Select value={filters.num} onValueChange={(v) => setFilter("num", v)}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {RESULT_COUNT_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Sort */}
                <div className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">
                    Sıralama
                  </Label>
                  <Select value={filters.sort_by} onValueChange={(v) => setFilter("sort_by", v)}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {SORT_OPTIONS.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
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
              <Table>
                <Table.Header>
                  <Table.Row className="bg-ui-bg-subtle">
                    {hasAction && (
                      <Table.HeaderCell className="w-[48px] pl-6">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onCheckedChange={toggleAll}
                        />
                      </Table.HeaderCell>
                    )}
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
                      key={index}
                      result={result}
                      isSelected={selectedIndexes.has(index)}
                      onToggle={() => toggleRow(index)}
                      selectable={hasAction}
                    />
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle">
            <Text size="xsmall" className="text-ui-fg-muted">
              {activeSource === "serpapi"
                ? "SerpAPI · Google Shopping Light"
                : "Serper.dev · Google Shopping"}
            </Text>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                İptal
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
                      İşleniyor...
                    </>
                  ) : (
                    actionLabel
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
