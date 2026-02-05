import { Button, Text } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { Modal, ModalBody, ModalFooter } from "../modal"
import { useSyncDetail } from "./sync-detail-context"

export function SyncDetailDeleteModal() {
  const { deleteDialogOpen, setDeleteDialogOpen, deleting, handleDelete } = useSyncDetail()

  return (
    <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Sync Sil" size="sm">
      <ModalBody>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <Text className="text-ui-fg-base text-sm">Bu sync'i silmek istediğinize emin misiniz?</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">Bu işlem geri alınamaz.</Text>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="small" onClick={() => setDeleteDialogOpen(false)}>İptal</Button>
          <Button variant="danger" size="small" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Siliniyor..." : "Sil"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}
