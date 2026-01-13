import { forwardRef, KeyboardEvent } from "react"
import { Input, Button, Text, Kbd, clx } from "@medusajs/ui"
import { MagnifyingGlass, XMark } from "@medusajs/icons"

type SearchInputProps = {
  /** Current search value */
  value: string
  /** Callback when value changes */
  onChange: (value: string) => void
  /** Callback when search is submitted (Enter key or button click) */
  onSearch: () => void
  /** Callback when search is cleared */
  onClear?: () => void
  /** Placeholder text */
  placeholder?: string
  /** Whether to show the search button */
  showButton?: boolean
  /** Whether to show the hint text */
  showHint?: boolean
  /** Whether the search is loading */
  isLoading?: boolean
  /** Custom class name */
  className?: string
  /** Auto focus the input */
  autoFocus?: boolean
}

/**
 * A reusable search input component with Enter key support
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = "Ara...",
  showButton = true,
  showHint = true,
  isLoading = false,
  className,
  autoFocus = false,
}, ref) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onSearch()
    }
  }

  const handleClear = () => {
    onChange("")
    onClear?.()
  }

  return (
    <div className={clx("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
          <Input
            ref={ref}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10"
            autoFocus={autoFocus}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-fg-muted hover:text-ui-fg-subtle"
            >
              <XMark className="h-4 w-4" />
            </button>
          )}
        </div>
        {showButton && (
          <Button 
            variant="secondary" 
            size="small"
            onClick={onSearch}
            disabled={isLoading}
          >
            <MagnifyingGlass className="h-4 w-4" />
            Ara
          </Button>
        )}
      </div>
      {showHint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          Aramak için <Kbd>Enter</Kbd> tuşuna basın
        </Text>
      )}
    </div>
  )
})

SearchInput.displayName = "SearchInput"

