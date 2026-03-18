import { useState, useMemo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Input, Label, Button, Text } from "@medusajs/ui"
import { XMark, Spinner as SpinnerIcon } from "@medusajs/icons"
import { CategoryTreeSelect } from "./category-tree-select"
import type { CategoryItem } from "./use-category-cache"

export type CategoryEditData = {
  name: string
  parent_category_id: string | null
}

type CategoryEditModalProps = {
  category: CategoryItem
  categories: CategoryItem[]
  onSave: (id: string, data: CategoryEditData) => Promise<void>
  onClose: () => void
}

export function CategoryEditModal({
  category,
  categories,
  onSave,
  onClose,
}: CategoryEditModalProps) {
  const [name, setName] = useState(category.name)
  const [parentId, setParentId] = useState<string | null>(
    category.parent_category_id ?? null
  )
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Focus name input on mount
  useEffect(() => {
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }, [])

  // Filter out self and all descendants to prevent circular parent reference
  const availableCategories = useMemo(() => {
    const descendants = new Set<string>()
    function collectDescendants(id: string) {
      descendants.add(id)
      for (const item of categories) {
        if (item.parent_category_id === id) {
          collectDescendants(item.id)
        }
      }
    }
    collectDescendants(category.id)
    return categories.filter((c) => !descendants.has(c.id))
  }, [categories, category.id])

  const hasChanges =
    name.trim() !== category.name ||
    parentId !== (category.parent_category_id ?? null)

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave(category.id, {
        name: name.trim(),
        parent_category_id: parentId,
      })
      onClose()
    } catch {
      // Error handled by parent via toast
    } finally {
      setSaving(false)
    }
  }

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  // Build parent name for display
  const parentName = useMemo(() => {
    if (!category.parent_category_id) return null
    return categories.find((c) => c.id === category.parent_category_id)?.name ?? null
  }, [categories, category.parent_category_id])

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-ui-bg-base rounded-xl shadow-elevation-modal border border-ui-border-base w-[460px] max-h-[90vh] overflow-hidden"
        style={{ animation: "categoryEditFadeIn 150ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border-base">
          <div className="flex flex-col gap-0.5">
            <Text size="large" weight="plus">
              Kategori Düzenle
            </Text>
            {parentName && (
              <Text size="xsmall" className="text-ui-fg-muted">
                Üst: {parentName}
              </Text>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-ui-bg-subtle-hover transition-colors"
          >
            <XMark className="h-4 w-4 text-ui-fg-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* ID (read-only) */}
          <div>
            <Label size="xsmall" className="text-ui-fg-muted mb-1.5 block">
              ID
            </Label>
            <Input
              value={category.id}
              disabled
              size="small"
              className="font-mono text-xs"
            />
          </div>

          {/* Name */}
          <div>
            <Label size="xsmall" className="mb-1.5 block">
              Kategori Adı
            </Label>
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              placeholder="Kategori adı girin..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && hasChanges && name.trim()) {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>

          {/* Parent category */}
          <div>
            <Label size="xsmall" className="mb-1.5 block">
              Üst Kategori
            </Label>
            <CategoryTreeSelect
              categories={availableCategories}
              value={parentId}
              onChange={setParentId}
              placeholder="Üst kategori seç (opsiyonel)..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ui-border-base bg-ui-bg-subtle">
          <Button
            variant="secondary"
            size="small"
            onClick={onClose}
            disabled={saving}
          >
            İptal
          </Button>
          <Button
            size="small"
            onClick={handleSave}
            disabled={!hasChanges || !name.trim() || saving}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <SpinnerIcon className="animate-spin h-3.5 w-3.5" />
                Kaydediliyor...
              </span>
            ) : (
              "Kaydet"
            )}
          </Button>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes categoryEditFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}
