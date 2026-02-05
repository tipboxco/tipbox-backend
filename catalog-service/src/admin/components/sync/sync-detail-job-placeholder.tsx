import { Heading, Text } from "@medusajs/ui"

const PlaceholderIcon = () => (
  <svg className="w-7 h-7 text-ui-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

export function SyncDetailJobPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-14 h-14 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-4">
        <PlaceholderIcon />
      </div>
      <Heading level="h3" className="text-sm mb-1">Bir job seçin</Heading>
      <Text size="xsmall" className="text-ui-fg-muted">Detayları görüntülemek için listeden bir job seçin.</Text>
    </div>
  )
}
