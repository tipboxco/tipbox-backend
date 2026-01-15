import { memo } from "react"
import { Checkbox, Text, Badge, clx } from "@medusajs/ui"
import { TagSolid, Photo } from "@medusajs/icons"

export type Brand = {
  id: string
  name: string
  logo_url?: string | null
}

type BrandRowProps = {
  brand: Brand
  isSelected: boolean
  onToggle: (brandId: string) => void
  className?: string

  /** Whether to show checkbox */
  showCheckbox?: boolean
}

/**
 * A single brand row component for use in brand lists
 * Memoized for performance with large lists
 */
export const BrandRow = memo(({ 
  brand, 
  isSelected, 
  onToggle,
  className,
  showCheckbox = true,
}: BrandRowProps) => (
  <div
    className={clx(
      "flex items-center gap-3 px-4 py-3 border-b border-ui-border-base cursor-pointer transition-colors",
      isSelected ? "bg-ui-bg-interactive/10" : "hover:bg-ui-bg-subtle-hover",
      className
    )}
    onClick={() => onToggle(brand.id)}
  >
    {showCheckbox && (
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(brand.id)}
        onClick={(e) => e.stopPropagation()}
      />
    )}
    <div className="flex-shrink-0">
      {false ? (
        <img 
          src={brand.logo_url} 
          alt={brand.name}
          className="w-10 h-10 rounded-md object-cover bg-ui-bg-subtle"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-ui-bg-component border border-ui-border-base">
          <TagSolid className="text-ui-fg-muted h-4 w-4" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <Text weight="plus" size="small" className="text-ui-fg-base truncate block">
        {brand.name}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted truncate block">
        {brand.id}
      </Text>
    </div>
  </div>
))

BrandRow.displayName = "BrandRow"

