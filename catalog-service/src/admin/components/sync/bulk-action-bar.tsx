import { Container, Text, Button } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"

type BulkActionBarProps = {
  selectedCount: number
  onClear: () => void
  onBulkDelete: () => void
  deleteLabel?: string
}

export const BulkActionBar = ({
  selectedCount,
  onClear,
  onBulkDelete,
  deleteLabel = "Seçilenleri sil",
}: BulkActionBarProps) => (
  <Container className="py-2 px-4 flex items-center justify-between border border-ui-border-base rounded-lg">
    <Text size="small" className="text-ui-fg-muted">{selectedCount} sync seçili</Text>
    <div className="flex items-center gap-2">
      <Button variant="transparent" size="small" onClick={onClear}>Seçimi kaldır</Button>
      <Button variant="secondary" size="small" onClick={onBulkDelete} className="text-ui-fg-error">
        <Trash className="h-3.5 w-3.5 mr-1" />
        {deleteLabel} ({selectedCount})
      </Button>
    </div>
  </Container>
)
