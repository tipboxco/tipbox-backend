import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Input, Text } from "@medusajs/ui"
import {
  MagnifyingGlass,
  ChevronRightMini,
  ChevronDownMini,
  XMark,
  Spinner as SpinnerIcon,
  FolderOpen,
  Minus,
  Check,
  Plus,
} from "@medusajs/icons"
import type { CategoryItem } from "./use-category-cache"

// ─── Types ───

export type CategoryNode = CategoryItem & {
  children: CategoryNode[]
  depth: number
}

type FlatRow = {
  node: CategoryNode
  isExpanded: boolean
  hasChildren: boolean
}

type ScoredRow = {
  node: CategoryNode
  score: number
  matchStart: number
  matchLength: number
}

export type CategoryTreeSelectProps = {
  categories: CategoryItem[]
  value: string | string[] | null
  onChange: (value: string | null) => void
  multiple?: boolean
  onMultiChange?: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  compact?: boolean
  onCreateCategory?: (name: string) => Promise<string | undefined> | void
}

// ─── HighlightedName ───

function HighlightedName({
  name,
  matchStart,
  matchLength,
  isSelected,
}: {
  name: string
  matchStart: number
  matchLength: number
  isSelected: boolean
}) {
  if (matchStart < 0 || matchLength <= 0) {
    return <span className="truncate">{name}</span>
  }

  const before = name.slice(0, matchStart)
  const match = name.slice(matchStart, matchStart + matchLength)
  const after = name.slice(matchStart + matchLength)

  return (
    <span className="truncate">
      {before}
      <span
        className={
          isSelected
            ? "font-semibold underline underline-offset-2"
            : "font-semibold bg-ui-tag-blue-bg text-ui-tag-blue-text rounded-sm px-0.5 -mx-0.5"
        }
      >
        {match}
      </span>
      {after}
    </span>
  )
}

// ─── Tree builder ───

function buildTree(items: CategoryItem[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>()
  const roots: CategoryNode[] = []

  for (const item of items) {
    map.set(item.id, { ...item, children: [], depth: 0 })
  }

  for (const item of items) {
    const node = map.get(item.id)!
    if (item.parent_category_id && map.has(item.parent_category_id)) {
      const parent = map.get(item.parent_category_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "tr"))
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(roots)

  return roots
}

// ─── Flatten tree to visible list ───

function flattenTree(
  nodes: CategoryNode[],
  expanded: Set<string>
): FlatRow[] {
  const rows: FlatRow[] = []

  function walk(node: CategoryNode) {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    rows.push({ node, isExpanded, hasChildren })

    if (hasChildren && isExpanded) {
      for (const child of node.children) walk(child)
    }
  }

  for (const root of nodes) walk(root)
  return rows
}

// ─── Relevance scoring for search ───

function scoreAndRankCategories(
  items: CategoryItem[],
  nodeMap: Map<string, CategoryNode>,
  query: string
): ScoredRow[] {
  const lower = query.toLowerCase()
  const results: ScoredRow[] = []

  for (const item of items) {
    const node = nodeMap.get(item.id)
    if (!node) continue

    const nameLower = item.name.toLowerCase()
    let score = 0
    let matchStart = -1

    if (nameLower === lower) {
      // Tam eşleşme
      score = 100
      matchStart = 0
    } else if (nameLower.startsWith(lower)) {
      // Baştan eşleşme
      score = 80
      matchStart = 0
    } else {
      // Kelime sınırı eşleşmesi: boşluk, tire, alt çizgi sonrası
      const separators = [" ", "-", "_", "/", "(", ")"]
      for (let i = 1; i < nameLower.length; i++) {
        if (separators.includes(nameLower[i - 1]) && nameLower.startsWith(lower, i)) {
          score = 60
          matchStart = i
          break
        }
      }
      // İçerik eşleşmesi
      if (score === 0) {
        const idx = nameLower.indexOf(lower)
        if (idx >= 0) {
          score = 40
          matchStart = idx
        }
      }
    }

    if (score > 0) {
      results.push({
        node,
        score,
        matchStart,
        matchLength: lower.length,
      })
    }
  }

  // Skor azalan, aynı skor içinde alfabetik
  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.node.name.localeCompare(b.node.name, "tr")
  })

  return results
}

// ─── Build name map for O(1) lookup ───

function buildNameMap(items: CategoryItem[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) map.set(item.id, item.name)
  return map
}

// ─── Build breadcrumb (parent > child) ───

function buildBreadcrumb(
  id: string,
  items: CategoryItem[],
  nameMap: Map<string, string>
): string {
  const parentMap = new Map<string, string | null>()
  for (const item of items) {
    parentMap.set(item.id, item.parent_category_id ?? null)
  }

  const parts: string[] = []
  let current: string | null = id
  while (current) {
    const name = nameMap.get(current)
    if (name) parts.unshift(name)
    current = parentMap.get(current) ?? null
    if (parts.length > 3) break
  }

  return parts.length > 2
    ? `${parts[0]} > ... > ${parts[parts.length - 1]}`
    : parts.join(" > ")
}

// ─── Build parent breadcrumb (excluding self) ───

function buildParentBreadcrumb(
  id: string,
  items: CategoryItem[],
  nameMap: Map<string, string>
): string {
  const parentMap = new Map<string, string | null>()
  for (const item of items) {
    parentMap.set(item.id, item.parent_category_id ?? null)
  }

  const parts: string[] = []
  let current: string | null = parentMap.get(id) ?? null
  while (current) {
    const name = nameMap.get(current)
    if (name) parts.unshift(name)
    current = parentMap.get(current) ?? null
    if (parts.length > 3) break
  }

  if (parts.length === 0) return ""
  return parts.length > 2
    ? `${parts[0]} > ... > ${parts[parts.length - 1]}`
    : parts.join(" > ")
}

// ─── Component ───

export function CategoryTreeSelect({
  categories,
  value,
  onChange,
  multiple,
  onMultiChange,
  placeholder = "Kategori seç...",
  disabled,
  loading,
  compact,
  onCreateCategory,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  // ─── Memoized computations ───
  const tree = useMemo(() => buildTree(categories), [categories])
  const nameMap = useMemo(() => buildNameMap(categories), [categories])

  // Node map for scoring
  const nodeMap = useMemo(() => {
    const map = new Map<string, CategoryNode>()
    function walk(node: CategoryNode) {
      map.set(node.id, node)
      for (const child of node.children) walk(child)
    }
    for (const root of tree) walk(root)
    return map
  }, [tree])

  const searchActive = search.trim().length > 0

  // ─── Dual-mode data ───
  const scoredRows = useMemo(
    () => (searchActive ? scoreAndRankCategories(categories, nodeMap, search.trim()) : []),
    [searchActive, categories, nodeMap, search]
  )

  const treeFlatRows = useMemo(
    () => (searchActive ? [] : flattenTree(tree, expanded)),
    [searchActive, tree, expanded]
  )

  // Active list length — "create" row counts as 1 when search has no matches
  const showCreateOption = searchActive && scoredRows.length === 0 && !!onCreateCategory
  const activeListLength = searchActive
    ? scoredRows.length + (showCreateOption ? 1 : 0)
    : treeFlatRows.length

  // ─── Selected values set (for multi-select) ───
  const selectedSet = useMemo(() => {
    if (!value) return new Set<string>()
    return new Set(Array.isArray(value) ? value : [value])
  }, [value])

  // ─── Display text ───
  const displayText = useMemo(() => {
    if (multiple && Array.isArray(value) && value.length > 0) {
      if (value.length === 1) return nameMap.get(value[0]) || placeholder
      return `${value.length} kategori seçili`
    }
    if (!multiple && typeof value === "string") {
      return compact
        ? (nameMap.get(value) || placeholder)
        : buildBreadcrumb(value, categories, nameMap)
    }
    return placeholder
  }, [value, multiple, nameMap, categories, placeholder, compact])

  // ─── Position dropdown ───
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 380

    setPosition({
      top: spaceBelow > dropdownHeight ? rect.bottom + 4 : rect.top - dropdownHeight - 4,
      left: rect.left,
      width: Math.max(rect.width, compact ? 300 : 340),
    })
  }, [compact])

  // ─── Open/close ───
  const handleOpen = useCallback(() => {
    if (disabled || loading) return
    updatePosition()
    setOpen(true)
    setSearch("")
    setHighlightedIndex(-1)
  }, [disabled, loading, updatePosition])

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return

    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    const handler = () => updatePosition()
    window.addEventListener("scroll", handler, true)
    window.addEventListener("resize", handler)
    return () => {
      window.removeEventListener("scroll", handler, true)
      window.removeEventListener("resize", handler)
    }
  }, [open, updatePosition])

  // Auto-highlight best match when search results change
  useEffect(() => {
    if (searchActive && scoredRows.length > 0) {
      setHighlightedIndex(0)
    } else if (searchActive && showCreateOption) {
      setHighlightedIndex(0)
    } else if (searchActive) {
      setHighlightedIndex(-1)
    }
  }, [searchActive, scoredRows, showCreateOption])

  // Scroll highlighted row into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex])

  // ─── Handlers ───
  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      if (multiple && onMultiChange) {
        const next = new Set(selectedSet)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onMultiChange(Array.from(next))
      } else {
        onChange(id)
        setOpen(false)
      }
    },
    [multiple, onMultiChange, onChange, selectedSet]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (multiple && onMultiChange) onMultiChange([])
      else onChange(null)
    },
    [multiple, onMultiChange, onChange]
  )

  // ─── Keyboard handler (scoped to Input) ───
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const { key } = e

      if (key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, activeListLength - 1))
      } else if (key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      } else if (key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault()
        if (searchActive) {
          if (scoredRows.length > 0) {
            const id = scoredRows[highlightedIndex]?.node.id
            if (id) handleSelect(id)
          } else if (showCreateOption && onCreateCategory) {
            const result = onCreateCategory(search.trim())
            if (result && typeof result.then === "function") {
              result.then((newId) => {
                if (newId) handleSelect(newId)
                else setOpen(false)
              })
            } else {
              setOpen(false)
            }
          }
        } else {
          const id = treeFlatRows[highlightedIndex]?.node.id
          if (id) handleSelect(id)
        }
      } else if (key === "Escape") {
        e.preventDefault()
        setOpen(false)
      } else if (key === "ArrowRight" && !searchActive && highlightedIndex >= 0) {
        e.preventDefault()
        const row = treeFlatRows[highlightedIndex]
        if (row?.hasChildren && !row.isExpanded) {
          // Expand
          setExpanded((prev) => new Set(prev).add(row.node.id))
        } else if (row?.hasChildren && row.isExpanded) {
          // Already open → move to first child
          setHighlightedIndex((prev) => prev + 1)
        }
      } else if (key === "ArrowLeft" && !searchActive && highlightedIndex >= 0) {
        e.preventDefault()
        const row = treeFlatRows[highlightedIndex]
        if (row?.hasChildren && row.isExpanded) {
          // Collapse
          setExpanded((prev) => {
            const next = new Set(prev)
            next.delete(row.node.id)
            return next
          })
        } else if (row?.node.parent_category_id) {
          // Navigate to parent
          const parentIdx = treeFlatRows.findIndex(
            (r) => r.node.id === row.node.parent_category_id
          )
          if (parentIdx >= 0) setHighlightedIndex(parentIdx)
        }
      }
    },
    [searchActive, scoredRows, treeFlatRows, highlightedIndex, activeListLength, handleSelect, showCreateOption, onCreateCategory, search]
  )

  // ─── Render ───
  const hasValue = multiple
    ? Array.isArray(value) && value.length > 0
    : !!value

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled || loading}
        title={hasValue ? displayText : undefined}
        className={[
          "group/trigger flex items-center gap-1.5 rounded-md border bg-ui-bg-field",
          "text-left transition-all duration-150",
          "hover:bg-ui-bg-field-hover focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          open
            ? "border-ui-border-interactive shadow-borders-interactive-with-active"
            : "border-ui-border-base shadow-borders-base hover:shadow-borders-strong",
          hasValue ? "text-ui-fg-base" : "text-ui-fg-muted",
        ].join(" ")}
        style={{ minWidth: compact ? 160 : 220, maxWidth: compact ? 220 : 360, width: "100%" }}
      >
        {loading ? (
          <SpinnerIcon className="animate-spin h-3.5 w-3.5 text-ui-fg-muted shrink-0" />
        ) : hasValue ? (
          <Check className="h-3 w-3 text-ui-fg-interactive shrink-0" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 text-ui-fg-muted shrink-0" />
        )}
        <span className="flex-1 truncate leading-tight">{displayText}</span>
        {hasValue && !disabled ? (
          <span
            onClick={handleClear}
            className="shrink-0 p-0.5 rounded-sm opacity-0 group-hover/trigger:opacity-100 transition-opacity hover:bg-ui-bg-subtle-hover"
          >
            <XMark className="h-3 w-3 text-ui-fg-muted" />
          </span>
        ) : (
          <ChevronDownMini
            className={[
              "h-4 w-4 text-ui-fg-muted shrink-0 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        )}
      </button>

      {/* Dropdown portal */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] flex flex-col rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout overflow-hidden"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: 380,
              animation: "categoryTreeFadeIn 120ms ease-out",
            }}
          >
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ui-fg-muted pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder="Kategori ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-8 h-8 text-sm !shadow-borders-base focus:!shadow-borders-interactive-with-active"
                  size="small"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      setHighlightedIndex(-1)
                      searchInputRef.current?.focus()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-ui-bg-subtle-hover"
                  >
                    <XMark className="h-3 w-3 text-ui-fg-muted" />
                  </button>
                )}
              </div>
              {searchActive && (
                <Text size="xsmall" className="text-ui-fg-muted mt-1.5 px-0.5">
                  {scoredRows.length} sonuç bulundu
                </Text>
              )}
            </div>

            <div className="h-px bg-ui-border-base" />

            {/* "Kategori yok" option */}
            {!multiple && !searchActive && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className={[
                  "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                  "border-b border-ui-border-base",
                  !hasValue
                    ? "bg-ui-bg-subtle text-ui-fg-base font-medium"
                    : "text-ui-fg-muted hover:bg-ui-bg-subtle-hover hover:text-ui-fg-base",
                ].join(" ")}
              >
                <Minus className="h-3.5 w-3.5 shrink-0" />
                <span>Kategori yok</span>
                {!hasValue && (
                  <Check className="h-3.5 w-3.5 ml-auto text-ui-fg-interactive" />
                )}
              </button>
            )}

            {/* List */}
            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain py-1" style={{ maxHeight: 280 }}>
              {searchActive ? (
                /* ─── Search mode: flat ranked list ─── */
              scoredRows.length === 0 ? (
                  <div className="flex flex-col">
                    <div className="flex flex-col items-center justify-center py-6 gap-1.5">
                      <MagnifyingGlass className="h-5 w-5 text-ui-fg-muted" />
                      <Text size="small" className="text-ui-fg-muted">
                        Sonuç bulunamadı
                      </Text>
                    </div>
                    {onCreateCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          const result = onCreateCategory(search.trim())
                          if (result && typeof result.then === "function") {
                            result.then((newId) => {
                              if (newId) handleSelect(newId)
                              else setOpen(false)
                            })
                          } else {
                            setOpen(false)
                          }
                        }}
                        onMouseEnter={() => setHighlightedIndex(0)}
                        className={[
                          "flex items-center gap-2.5 w-full text-left text-sm py-[7px] px-3 transition-colors duration-75",
                          "border-t border-ui-border-base",
                          highlightedIndex === 0
                            ? "bg-ui-bg-subtle-hover text-ui-fg-base"
                            : "text-ui-fg-base hover:bg-ui-bg-subtle-hover",
                        ].join(" ")}
                      >
                        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-sm bg-ui-bg-interactive">
                          <Plus className="h-3.5 w-3.5 text-ui-fg-on-color" />
                        </span>
                        <span>
                          <span className="text-ui-fg-muted">Oluştur: </span>
                          <span className="font-medium">"{search.trim()}"</span>
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-ui-fg-muted bg-ui-bg-subtle border border-ui-border-base rounded px-1.5 py-0.5 font-mono leading-none">
                          Enter
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  scoredRows.map(({ node, matchStart, matchLength }, index) => {
                    const isSelected = selectedSet.has(node.id)
                    const isHighlighted = index === highlightedIndex
                    const hasChildren = node.children.length > 0
                    const parentPath = buildParentBreadcrumb(node.id, categories, nameMap)
                    return (
                      <button
                        key={node.id}
                        type="button"
                        title={parentPath ? `${parentPath} > ${node.name}` : node.name}
                        onClick={() => handleSelect(node.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={[
                          "flex items-center w-full text-left text-sm py-[7px] px-3 transition-colors duration-75 gap-2",
                          isSelected
                            ? "bg-ui-bg-interactive text-ui-fg-on-color"
                            : isHighlighted
                              ? "bg-ui-bg-subtle-hover text-ui-fg-base"
                              : "text-ui-fg-base hover:bg-ui-bg-subtle-hover",
                        ].join(" ")}
                      >
                        {/* Multi-select checkbox */}
                        {multiple && (
                          <span className="shrink-0 flex items-center">
                            <span
                              className={[
                                "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                                isSelected
                                  ? "bg-white border-white/40"
                                  : "border-ui-border-strong bg-ui-bg-field",
                              ].join(" ")}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-ui-fg-interactive" />
                              )}
                            </span>
                          </span>
                        )}

                        {/* Folder icon for parent categories */}
                        {hasChildren && !isSelected && (
                          <FolderOpen className="h-3.5 w-3.5 text-ui-fg-muted shrink-0" />
                        )}

                        {/* Highlighted name */}
                        <HighlightedName
                          name={node.name}
                          matchStart={matchStart}
                          matchLength={matchLength}
                          isSelected={isSelected}
                        />

                        {/* Parent breadcrumb */}
                        {parentPath && (
                          <span
                            className={[
                              "ml-auto shrink-0 text-[11px] truncate max-w-[140px]",
                              isSelected ? "text-ui-fg-on-color/60" : "text-ui-fg-muted",
                            ].join(" ")}
                          >
                            {parentPath}
                          </span>
                        )}

                        {/* Selected check (single mode) */}
                        {isSelected && !multiple && !parentPath && (
                          <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                        )}
                        {isSelected && !multiple && parentPath && (
                          <Check className="h-3.5 w-3.5 shrink-0 ml-1.5" />
                        )}
                      </button>
                    )
                  })
                )
              ) : (
                /* ─── Tree mode: hierarchical view ─── */
                treeFlatRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <FolderOpen className="h-5 w-5 text-ui-fg-muted" />
                    <Text size="small" className="text-ui-fg-muted">
                      Kategori bulunamadı
                    </Text>
                  </div>
                ) : (
                  treeFlatRows.map(({ node, isExpanded, hasChildren }, index) => {
                    const isSelected = selectedSet.has(node.id)
                    const isHighlighted = index === highlightedIndex
                    return (
                      <button
                        key={node.id}
                        type="button"
                        title={node.name}
                        onClick={() => handleSelect(node.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={[
                          "flex items-center w-full text-left text-sm py-[7px] pr-3 transition-colors duration-75",
                          isSelected
                            ? "bg-ui-bg-interactive text-ui-fg-on-color"
                            : isHighlighted
                              ? "bg-ui-bg-subtle-hover text-ui-fg-base"
                              : "text-ui-fg-base hover:bg-ui-bg-subtle-hover",
                        ].join(" ")}
                        style={{ paddingLeft: 12 + node.depth * 20 }}
                      >
                        {/* Expand/collapse icon */}
                        {hasChildren ? (
                          <span
                            onClick={(e) => toggleExpand(node.id, e)}
                            className={[
                              "shrink-0 flex items-center justify-center w-5 h-5 rounded-sm mr-1 transition-colors",
                              isSelected
                                ? "hover:bg-white/20"
                                : "hover:bg-ui-bg-base-hover",
                            ].join(" ")}
                          >
                            {isExpanded ? (
                              <ChevronDownMini className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRightMini className="h-3.5 w-3.5" />
                            )}
                          </span>
                        ) : (
                          <span className="shrink-0 w-5 mr-1" />
                        )}

                        {/* Multi-select checkbox */}
                        {multiple && (
                          <span className="shrink-0 mr-2 flex items-center">
                            <span
                              className={[
                                "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                                isSelected
                                  ? "bg-white border-white/40"
                                  : "border-ui-border-strong bg-ui-bg-field",
                              ].join(" ")}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-ui-fg-interactive" />
                              )}
                            </span>
                          </span>
                        )}

                        {/* Folder icon for parent categories */}
                        {hasChildren && !isSelected && (
                          <FolderOpen className="h-3.5 w-3.5 text-ui-fg-muted shrink-0 mr-1.5" />
                        )}
                        <span className="truncate">{node.name}</span>

                        {/* Selected check mark (single mode) */}
                        {isSelected && !multiple && (
                          <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                        )}

                        {/* Child count badge */}
                        {hasChildren && !isSelected && (
                          <span className="ml-auto shrink-0 text-[10px] leading-none text-ui-fg-muted bg-ui-bg-subtle rounded-full px-1.5 py-0.5 font-mono">
                            {node.children.length}
                          </span>
                        )}
                      </button>
                    )
                  })
                )
              )}
            </div>

            {/* Footer info */}
            {multiple && selectedSet.size > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-ui-border-base bg-ui-bg-subtle">
                <Text size="xsmall" className="text-ui-fg-muted">
                  {selectedSet.size} kategori seçili
                </Text>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                >
                  Temizle
                </button>
              </div>
            )}

            {/* Total count footer */}
            {!multiple && categories.length > 0 && (
              <div className="px-3 py-1.5 border-t border-ui-border-base bg-ui-bg-subtle">
                <Text size="xsmall" className="text-ui-fg-disabled">
                  {searchActive
                    ? `${scoredRows.length} / ${categories.length} kategori`
                    : `${categories.length} kategori`
                  }
                </Text>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Animation keyframes */}
      {open &&
        createPortal(
          <style>{`
            @keyframes categoryTreeFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>,
          document.head
        )}
    </>
  )
}
