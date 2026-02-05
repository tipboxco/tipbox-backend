import { useMemo, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Container,
  Heading,
  Text,
  Button,
  Table,
  Input,
  Select,
} from "@medusajs/ui"
import {
  ArrowPath,
  PlaySolid,
  PlusMini,
  Spinner,
  ArrowUpRightOnBox,
  MagnifyingGlass,
  ChevronLeft,
  ChevronRight,
} from "@medusajs/icons"
import type { BackendSeedItem } from "./types"

const PAGE_SIZES = [10, 25, 50] as const
const SOURCE_FILTER_ALL = "__all__"
const URL_KEYS = { q: "q", source: "source", page: "page", pageSize: "pageSize" } as const

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value == null || value === "") return fallback
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

type BackendSeedSectionProps = {
  seeds: BackendSeedItem[]
  loading: boolean
  runLoading: boolean
  addingId: string | null
  runningId: string | null
  onRefresh: () => void
  onAdd: (seed: BackendSeedItem) => void
  onRun: (seed: BackendSeedItem) => void
}

export const BackendSeedSection = ({
  seeds,
  loading,
  runLoading,
  addingId,
  runningId,
  onRefresh,
  onAdd,
  onRun,
}: BackendSeedSectionProps) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get(URL_KEYS.q) ?? ""
  const sourceFilter = searchParams.get(URL_KEYS.source) ?? SOURCE_FILTER_ALL
  const page = parsePositiveInt(searchParams.get(URL_KEYS.page), 1)
  const rawPageSize = parsePositiveInt(searchParams.get(URL_KEYS.pageSize), 10)
  const safePageSize: (typeof PAGE_SIZES)[number] = PAGE_SIZES.includes(rawPageSize as 10 | 25 | 50) ? (rawPageSize as 10 | 25 | 50) : 10

  const setUrlParams = useCallback(
    (updates: { q?: string; source?: string; page?: number; pageSize?: number }) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (updates.q !== undefined) (updates.q === "" ? next.delete(URL_KEYS.q) : next.set(URL_KEYS.q, updates.q))
        if (updates.source !== undefined) (updates.source === "" || updates.source === SOURCE_FILTER_ALL ? next.delete(URL_KEYS.source) : next.set(URL_KEYS.source, updates.source))
        if (updates.page !== undefined) (updates.page === 1 ? next.delete(URL_KEYS.page) : next.set(URL_KEYS.page, String(updates.page)))
        if (updates.pageSize !== undefined) (updates.pageSize === 10 ? next.delete(URL_KEYS.pageSize) : next.set(URL_KEYS.pageSize, String(updates.pageSize)))
        return next
      })
    },
    [setSearchParams]
  )

  const sourceOptions = useMemo(() => {
    const dirs = Array.from(new Set(seeds.map((s) => s.sourceDir).filter(Boolean))) as string[]
    dirs.sort()
    return dirs
  }, [seeds])

  const filtered = useMemo(() => {
    let list = seeds
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.relativePath && s.relativePath.toLowerCase().includes(q)) ||
          (s.sourceDir && s.sourceDir.toLowerCase().includes(q))
      )
    }
    if (sourceFilter && sourceFilter !== SOURCE_FILTER_ALL) {
      list = list.filter((s) => s.sourceDir === sourceFilter)
    }
    return list
  }, [seeds, search, sourceFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * safePageSize
  const paginated = useMemo(
    () => filtered.slice(start, start + safePageSize),
    [filtered, start, safePageSize]
  )

  const goPrev = () => setUrlParams({ page: Math.max(1, currentPage - 1) })
  const goNext = () => setUrlParams({ page: Math.min(totalPages, currentPage + 1) })

  return (
    <Container className="divide-y p-0 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-ui-border-base">
        <div>
          <Heading level="h2" className="text-base">Backend Seed (Tipbox)</Heading>
          <Text size="xsmall" className="text-ui-fg-muted">Her seed için ayrı sync config; prisma/seed ve scripts kaynakları</Text>
        </div>
        <Button variant="secondary" size="small" onClick={onRefresh} disabled={loading}>
          <ArrowPath className={loading ? "animate-spin" : ""} />Yenile
        </Button>
      </div>

      {!loading && seeds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-ui-border-base">
          <div className="relative flex-1 min-w-[180px] max-w-[240px]">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ui-fg-muted" />
            <Input
              placeholder="Dosya veya yol ara..."
              value={search}
              onChange={(e) => setUrlParams({ q: e.target.value, page: 1 })}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => setUrlParams({ source: v, page: 1 })}>
            <Select.Trigger className="w-[160px] h-8 text-xs">
              <Select.Value placeholder="Tüm kaynaklar" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={SOURCE_FILTER_ALL}>Tüm kaynaklar</Select.Item>
              {sourceOptions.map((dir) => (
                <Select.Item key={dir} value={dir}>{dir}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="animate-spin h-6 w-6 text-ui-fg-interactive" />
        </div>
      ) : seeds.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Text size="small" className="text-ui-fg-muted">Backend seed listesi yok veya bağlantı kurulamadı.</Text>
        </div>
      ) : (
        <div className="px-0">
          <Table>
            <Table.Header>
              <Table.Row className="bg-ui-bg-subtle">
                <Table.HeaderCell className="pl-4">Kaynak</Table.HeaderCell>
                <Table.HeaderCell>ID (hash)</Table.HeaderCell>
                <Table.HeaderCell>Dosya adı</Table.HeaderCell>
                <Table.HeaderCell>Yol</Table.HeaderCell>
                <Table.HeaderCell className="text-right">İşlem</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginated.map((s) => (
                <Table.Row key={s.id}>
                  <Table.Cell className="pl-4">
                    <Text size="xsmall" className="font-mono text-ui-fg-muted" title={s.sourceDir || "—"}>
                      {s.sourceDir || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs">{s.id.slice(0, 12)}…</Table.Cell>
                  <Table.Cell><Text size="small" weight="plus">{s.name}</Text></Table.Cell>
                  <Table.Cell><Text size="xsmall" className="text-ui-fg-muted font-mono truncate max-w-[200px] block" title={s.relativePath}>{s.relativePath}</Text></Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.sync_config_id ? (
                        <>
                          <Button variant="transparent" size="small" onClick={() => navigate(`/settings/sync/${s.sync_config_id}`)}>
                            <ArrowUpRightOnBox className="h-3.5 w-3.5 mr-1" />Job detay
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => onRun(s)}
                            disabled={runLoading || loading}
                          >
                            {runningId === s.id ? <Spinner className="animate-spin h-3.5 w-3.5 mr-1" /> : <PlaySolid className="h-3.5 w-3.5 mr-1" />}
                            Çalıştır
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => onAdd(s)}
                          disabled={loading || addingId != null}
                        >
                          {addingId === s.id ? <Spinner className="animate-spin h-3.5 w-3.5 mr-1" /> : <PlusMini className="h-3.5 w-3.5 mr-1" />}
                          Ekle
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-ui-border-base">
              <div className="flex items-center gap-2">
                <Text size="xsmall" className="text-ui-fg-muted">
                  {total === 0 ? "0 / 0" : `${start + 1}-${Math.min(start + safePageSize, total)} / ${total}`}
                </Text>
                <Select
                  value={String(safePageSize)}
                  onValueChange={(v) => setUrlParams({ pageSize: Number(v) as 10 | 25 | 50, page: 1 })}
                >
                  <Select.Trigger className="w-[70px] h-7 text-xs" />
                  <Select.Content>
                    {PAGE_SIZES.map((n) => (
                      <Select.Item key={n} value={String(n)}>{n}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="transparent"
                  size="small"
                  onClick={goPrev}
                  disabled={currentPage <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Text size="xsmall" className="text-ui-fg-muted w-16 text-center">
                  {currentPage} / {totalPages}
                </Text>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={goNext}
                  disabled={currentPage >= totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Container>
  )
}
