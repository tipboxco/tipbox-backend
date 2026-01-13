import { clx } from "@medusajs/ui"

type SkeletonProps = {
  className?: string
}

/**
 * Basic skeleton component for loading states
 */
export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={clx("bg-ui-bg-component rounded animate-pulse", className)} />
)

/**
 * Skeleton for a single product row in a list
 */
export const ProductRowSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-ui-border-base animate-pulse">
    <div className="w-5 h-5 bg-ui-bg-component rounded" />
    <div className="w-10 h-10 bg-ui-bg-component rounded-md flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="h-4 bg-ui-bg-component rounded w-3/4 mb-1.5" />
      <div className="h-3 bg-ui-bg-component rounded w-1/2" />
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="h-5 w-14 bg-ui-bg-component rounded-full" />
      <div className="h-3 w-16 bg-ui-bg-component rounded" />
    </div>
  </div>
)

type ProductListSkeletonProps = {
  /** Number of skeleton rows to display */
  count?: number
}

/**
 * Skeleton for a list of products
 */
export const ProductListSkeleton = ({ count = 8 }: ProductListSkeletonProps) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <ProductRowSkeleton key={i} />
    ))}
  </div>
)

/**
 * Skeleton for a table row
 */
export const TableRowSkeleton = ({ columns = 4 }: { columns?: number }) => (
  <div className="flex items-center gap-4 px-6 py-3 border-b border-ui-border-base animate-pulse">
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="flex-1">
        <div className="h-4 bg-ui-bg-component rounded w-3/4" />
      </div>
    ))}
  </div>
)

/**
 * Skeleton for a card
 */
export const CardSkeleton = ({ className }: SkeletonProps) => (
  <div className={clx("bg-ui-bg-base border border-ui-border-base rounded-lg p-4 animate-pulse", className)}>
    <div className="h-5 bg-ui-bg-component rounded w-1/2 mb-3" />
    <div className="h-4 bg-ui-bg-component rounded w-3/4 mb-2" />
    <div className="h-4 bg-ui-bg-component rounded w-1/3" />
  </div>
)

