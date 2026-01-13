import { useState, useEffect, useCallback, useRef } from "react"
import { Modal, ModalBody, ModalFooter } from "../modal"
import {
  Button,
  Text,
  Input,
  IconButton,
  toast,
  clx,
  Badge,
  Skeleton,
} from "@medusajs/ui"
import {
  Photo,
  XMark,
  MagnifyingGlass,
  Spinner,
  ArrowUpTray,
  CheckCircleSolid,
} from "@medusajs/icons"

type MediaFile = {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
}

type MediaPickerDialogProps = {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when an image is selected */
  onSelect: (url: string) => void
  /** Currently selected image URL */
  selectedUrl?: string | null
}

/**
 * Media picker dialog component
 * Allows users to browse, upload, and select media files
 * Follows Medusa design system guidelines
 */
export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  selectedUrl,
}: MediaPickerDialogProps) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // Fetch media files
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/admin/media", {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Medya listesi alınamadı")
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error: any) {
      toast.error("Hata", {
        description: error.message || "Medya listesi yüklenemedi",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Load files when dialog opens
  useEffect(() => {
    if (open) {
      fetchFiles()
      setSearchQuery("")
    }
  }, [open, fetchFiles])

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      // Validate file
      if (!file.type.startsWith("image/")) {
        toast.error("Hata", { description: "Lütfen geçerli bir resim dosyası seçin" })
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Hata", {
          description: "Resim boyutu 10MB'dan küçük olmalıdır",
        })
        return
      }

      setUploading(true)
      try {
        // Compress image if needed to reduce payload size
        // Compression threshold lowered to 50KB to reduce payload size
        let base64: string
        const { compressImage, needsCompression } = await import("./utils/image-compression")
        
        if (needsCompression(file, 50)) {
          // More aggressive compression for larger files
          // Quality reduced to 0.7 and max dimensions to 1200px
          base64 = await compressImage(file, 1200, 1200, 0.7)
        } else if (file.size > 30 * 1024) {
          // Light compression for medium files (30-50KB)
          base64 = await compressImage(file, 1600, 1600, 0.85)
        } else {
          // For smaller images, use original
          const reader = new FileReader()
          base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
              const result = e.target?.result as string
              resolve(result)
            }
            reader.onerror = () => reject(new Error("Dosya okunamadı"))
            reader.readAsDataURL(file)
          })
        }

        const response = await fetch("/admin/media", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            filename: file.name,
            mimeType: file.type,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Resim yüklenemedi")
        }

        const data = await response.json()
        setFiles((prev) => [data.file, ...prev])
        toast.success("Başarılı", { description: "Resim yüklendi" })
      } catch (error: any) {
        toast.error("Hata", {
          description: error.message || "Resim yüklenirken hata oluştu",
        })
      } finally {
        setUploading(false)
      }
    },
    []
  )

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles[0])
    }
  }

  // Filter files by search query
  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="4xl"
      title="Medya Kütüphanesi"
      description="Resimleri görüntüleyin, yükleyin veya seçin"
    >
      <ModalBody className="p-0">
        {/* Search and Upload Bar */}
        <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center gap-x-3">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ui-fg-muted pointer-events-none" />
              <Input
                placeholder="Resim ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                size="small"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              id="media-upload-input"
            />
            <Button
              variant="secondary"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Spinner className="animate-spin h-4 w-4 mr-2" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <ArrowUpTray className="h-4 w-4 mr-2" />
                  Yükle
                </>
              )}
            </Button>
          </div>
          {files.length > 0 && (
            <div className="mt-3 flex items-center gap-x-2">
              <Badge color="grey" size="2xsmall">
                {filteredFiles.length} resim
              </Badge>
              {searchQuery && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  "{searchQuery}" için sonuçlar
                </Text>
              )}
            </div>
          )}
        </div>

        {/* Media Grid */}
        <div
          className={clx(
            "p-6 min-h-[400px] max-h-[60vh] overflow-y-auto transition-colors",
            isDragging && "bg-ui-bg-interactive/5"
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ui-bg-component mb-4">
                <Photo className="h-8 w-8 text-ui-fg-muted" />
              </div>
              <Text size="small" weight="plus" className="text-ui-fg-base mb-1">
                {searchQuery ? "Sonuç bulunamadı" : "Henüz resim yüklenmedi"}
              </Text>
              {!searchQuery && (
                <Text size="xsmall" className="text-ui-fg-subtle max-w-sm">
                  Resim yüklemek için yukarıdaki "Yükle" butonunu kullanın veya
                  dosyaları buraya sürükleyip bırakın
                </Text>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isSelected = selectedUrl === file.url
                return (
                  <div
                    key={file.id}
                    className={clx(
                      "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                      isSelected
                        ? "border-ui-fg-interactive ring-2 ring-ui-fg-interactive/20 shadow-elevation-card"
                        : "border-ui-border-base hover:border-ui-border-strong hover:shadow-elevation-card"
                    )}
                    onClick={() => onSelect(file.url)}
                  >
                    <div className="aspect-square bg-ui-bg-subtle relative">
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-ui-fg-interactive/10 flex items-center justify-center">
                          <div className="bg-ui-fg-interactive text-ui-fg-on-interactive rounded-full p-1.5 shadow-elevation-flyout">
                            <CheckCircleSolid className="h-5 w-5" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ui-bg-overlay to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Text
                        size="xsmall"
                        weight="plus"
                        className="text-ui-fg-on-color truncate block"
                        title={file.filename}
                      >
                        {file.filename}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-on-color/70">
                        {(file.size / 1024).toFixed(0)} KB
                      </Text>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (selectedUrl) {
              onSelect(selectedUrl)
              onClose()
            }
          }}
          disabled={!selectedUrl}
        >
          Seç
        </Button>
      </ModalFooter>
    </Modal>
  )
}
