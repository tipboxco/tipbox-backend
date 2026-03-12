import { useState, useCallback } from "react"
import {
  Heading,
  Button,
  Text,
  Input,
  Badge,
  IconButton,
  Checkbox,
  Table,
  clx,
  toast,
} from "@medusajs/ui"
import {
  MagnifyingGlass,
  XMark,
  Photo,
  Spinner,
  ArrowUpRightOnBox,
  CheckCircleSolid,
} from "@medusajs/icons"
import { backendUrl } from "../../lib/config"

type SerpSource = "serpapi" | "serper"

type SerpResult = {
  title: string
  price?: string
  image?: string
  link?: string
  source?: string
  rating?: number
  reviews?: number
}

type SerpSearchModalProps = {
  open: boolean
  onClose: () => void
  brandId: string
  onImportSuccess?: () => void
}

export const SerpSearchModal = ({
  open,
  onClose,
  brandId,
  onImportSuccess,
}: SerpSearchModalProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSource, setActiveSource] = useState<SerpSource>("serpapi")
  const [results, setResults] = useState<SerpResult[]>([])
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState("")

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim()
    if (!query) return

    setIsLoading(true)
    setHasSearched(true)
    setLastQuery(query)
    setSelectedIndexes(new Set())

    try {
      const params = new URLSearchParams({ q: query, source: activeSource })
      const response = await fetch(`${backendUrl}/admin/serp-search?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error("Arama Hatası", {
          description: data.error || "Arama sırasında hata oluştu",
        })
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
  }, [searchQuery, activeSource])

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

  const toggleRow = (index: number) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIndexes.size === results.length) {
      setSelectedIndexes(new Set())
    } else {
      setSelectedIndexes(new Set(results.map((_, i) => i)))
    }
  }

  const handleImport = async () => {
    if (selectedIndexes.size === 0) return

    const selectedProducts = Array.from(selectedIndexes).map((i) => results[i])

    setIsImporting(true)
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
          description: `${data.successful} ürün aktarıldı, ${data.failed} ürün başarısız`,
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
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    setSearchQuery("")
    setResults([])
    setHasSearched(false)
    setLastQuery("")
    setSelectedIndexes(new Set())
    onClose()
  }

  if (!open) return null

  const allSelected = results.length > 0 && selectedIndexes.size === results.length
  const someSelected = selectedIndexes.size > 0 && selectedIndexes.size < results.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ui-bg-overlay" onClick={handleClose} />

      {/* Modal Container */}
      <div className="relative bg-ui-bg-base rounded-lg shadow-elevation-modal w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
          <div>
            <Heading level="h2" className="text-ui-fg-base">
              SERP ile Ürün Ara
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              Google Shopping üzerinden ürün arayın ve markaya aktarın
            </Text>
          </div>
          <IconButton variant="transparent" size="small" onClick={handleClose}>
            <XMark className="h-5 w-5" />
          </IconButton>
        </div>

        {/* Source Toggle + Search Bar */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle space-y-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-muted">
              Kaynak:
            </Text>
            <button
              type="button"
              onClick={() => handleSourceChange("serpapi")}
              className={clx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeSource === "serpapi"
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "bg-ui-bg-base text-ui-fg-subtle border border-ui-border-base hover:bg-ui-bg-base-hover"
              )}
            >
              SerpAPI
            </button>
            <button
              type="button"
              onClick={() => handleSourceChange("serper")}
              className={clx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeSource === "serper"
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "bg-ui-bg-base text-ui-fg-subtle border border-ui-border-base hover:bg-ui-bg-base-hover"
              )}
            >
              Serper.dev
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
              <Input
                placeholder="Ürün adı veya anahtar kelime girin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button
              variant="primary"
              size="base"
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
            >
              {isLoading ? (
                <>
                  <Spinner className="animate-spin h-4 w-4" />
                  Aranıyor...
                </>
              ) : (
                <>
                  <MagnifyingGlass className="h-4 w-4" />
                  Ara
                </>
              )}
            </Button>
          </div>

          {/* Result count */}
          {hasSearched && !isLoading && (
            <div className="flex items-center justify-between">
              <Text size="xsmall" className="text-ui-fg-muted">
                &ldquo;{lastQuery}&rdquo; için{" "}
                <span className="font-medium text-ui-fg-subtle">
                  {activeSource === "serpapi" ? "SerpAPI" : "Serper.dev"}
                </span>{" "}
                sonuçları
              </Text>
              <Badge color="grey" size="small">
                {results.length} sonuç
              </Badge>
            </div>
          )}
        </div>

        {/* Selection Status Bar */}
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

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Spinner className="animate-spin h-8 w-8 text-ui-fg-interactive mb-4" />
              <Text className="text-ui-fg-subtle">Aranıyor...</Text>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <MagnifyingGlass className="text-ui-fg-muted h-8 w-8" />
              </div>
              <Text weight="plus" className="text-ui-fg-base mb-1">
                Arama yapın
              </Text>
              <Text size="small" className="text-ui-fg-subtle text-center max-w-sm">
                Bir ürün adı veya anahtar kelime girin ve Enter&apos;a basın
              </Text>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
                <MagnifyingGlass className="text-ui-fg-muted h-8 w-8" />
              </div>
              <Text weight="plus" className="text-ui-fg-base mb-1">
                Sonuç bulunamadı
              </Text>
              <Text size="small" className="text-ui-fg-subtle text-center max-w-sm">
                &ldquo;{lastQuery}&rdquo; için sonuç bulunamadı. Farklı bir arama deneyin.
              </Text>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row className="bg-ui-bg-subtle">
                  <Table.HeaderCell className="w-[48px] pl-6">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleAll}
                    />
                  </Table.HeaderCell>
                  <Table.HeaderCell className="w-[64px]">Görsel</Table.HeaderCell>
                  <Table.HeaderCell>Ürün Adı</Table.HeaderCell>
                  <Table.HeaderCell className="w-[120px]">Fiyat</Table.HeaderCell>
                  <Table.HeaderCell className="w-[160px]">Kaynak</Table.HeaderCell>
                  <Table.HeaderCell className="w-[100px]">Puan</Table.HeaderCell>
                  <Table.HeaderCell className="w-[60px]">Link</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {results.map((result, index) => (
                  <SerpTableRow
                    key={index}
                    result={result}
                    isSelected={selectedIndexes.has(index)}
                    onToggle={() => toggleRow(index)}
                  />
                ))}
              </Table.Body>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-ui-border-base bg-ui-bg-subtle">
          <Text size="small" className="text-ui-fg-muted">
            Sonuçlar{" "}
            {activeSource === "serpapi"
              ? "SerpAPI (Google Shopping Light)"
              : "Serper.dev (Google Shopping)"}{" "}
            üzerinden getirilmektedir
          </Text>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={selectedIndexes.size === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Spinner className="animate-spin h-4 w-4" />
                  Aktarılıyor...
                </>
              ) : (
                `${selectedIndexes.size > 0 ? `${selectedIndexes.size} Ürünü ` : ""}Import Et`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

type SerpTableRowProps = {
  result: SerpResult
  isSelected: boolean
  onToggle: () => void
}

const SerpTableRow = ({ result, isSelected, onToggle }: SerpTableRowProps) => {
  const [imgError, setImgError] = useState(false)

  return (
    <Table.Row
      className={clx(
        "group cursor-pointer hover:bg-ui-bg-subtle-hover",
        isSelected && "bg-ui-bg-highlight hover:bg-ui-bg-highlight-hover"
      )}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <Table.Cell className="pl-6" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={onToggle} />
      </Table.Cell>

      {/* Thumbnail */}
      <Table.Cell>
        <div className="w-10 h-10 rounded-md bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center overflow-hidden">
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
          <Text size="small" weight="plus" className="text-ui-fg-interactive">
            {result.price}
          </Text>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            —
          </Text>
        )}
      </Table.Cell>

      {/* Source */}
      <Table.Cell>
        <Text size="small" className="text-ui-fg-subtle truncate max-w-[150px]">
          {result.source || "—"}
        </Text>
      </Table.Cell>

      {/* Rating */}
      <Table.Cell>
        {result.rating !== undefined ? (
          <div className="flex flex-col">
            <Text size="small" className="text-ui-fg-subtle">
              ★ {result.rating.toFixed(1)}
            </Text>
            {result.reviews !== undefined && (
              <Text size="xsmall" className="text-ui-fg-muted">
                ({result.reviews.toLocaleString()})
              </Text>
            )}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            —
          </Text>
        )}
      </Table.Cell>

      {/* External Link */}
      <Table.Cell onClick={(e) => e.stopPropagation()}>
        {result.link ? (
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex"
            title="Ürünü aç"
          >
            <ArrowUpRightOnBox className="h-4 w-4 text-ui-fg-muted hover:text-ui-fg-subtle" />
          </a>
        ) : null}
      </Table.Cell>
    </Table.Row>
  )
}
