import { memo } from "react"
import { Checkbox, Badge, Text, clx } from "@medusajs/ui"
import { Photo } from "@medusajs/icons"

export type Product = {
  id: string
  title: string
  handle: string
  thumbnail?: string
  status: string
  variants?: { id: string }[]
}

type ProductRowProps = {
  /** Product data to display */
  product: Product
  /** Whether this product is selected */
  isSelected: boolean
  /** Callback when selection is toggled */
  onToggle: (id: string) => void
  /** Optional custom class name */
  className?: string
  /** Whether to show the checkbox */
  showCheckbox?: boolean
  /** Whether to show the status badge */
  showStatus?: boolean
  /** Whether to show variant count */
  showVariantCount?: boolean
}

/**
 * A single product row component for use in product lists
 * Memoized for performance with large lists
 */
export const ProductRow = memo(({ 
  product, 
  isSelected, 
  onToggle,
  className,
  showCheckbox = true,
  showStatus = true,
  showVariantCount = true,
}: ProductRowProps) => (
  <div
    className={clx(
      "flex items-center gap-3 px-4 py-3 border-b border-ui-border-base cursor-pointer transition-colors",
      isSelected ? "bg-ui-bg-interactive/10" : "hover:bg-ui-bg-subtle-hover",
      className
    )}
    onClick={() => onToggle(product.id)}
  >
    {showCheckbox && (
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(product.id)}
        onClick={(e) => e.stopPropagation()}
      />
    )}
    <div className="flex-shrink-0">
      {product.thumbnail ? (
        <img 
          src={product.thumbnail} 
          alt={product.title}
          className="w-10 h-10 rounded-md object-cover bg-ui-bg-subtle"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-ui-bg-component border border-ui-border-base">
          <Photo className="text-ui-fg-muted h-4 w-4" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <Text weight="plus" size="small" className="text-ui-fg-base truncate block">
        {product.title}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted truncate block">
        {product.handle}
      </Text>
    </div>
    <div className="flex-shrink-0 flex items-center gap-2">
      {showStatus && (
        <Badge color={product.status === "published" ? "green" : "grey"} size="small">
          {product.status === "published" ? "Yayında" : "Taslak"}
        </Badge>
      )}
      {showVariantCount && (
        <Text size="xsmall" className="text-ui-fg-muted w-16 text-right">
          {product.variants?.length || 0} varyant
        </Text>
      )}
    </div>
  </div>
))

ProductRow.displayName = "ProductRow"

