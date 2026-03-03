import { useState, useEffect, useCallback, useRef } from "react"
import { backendUrl } from "../../lib/config"
import { Modal, ModalBody, ModalFooter } from "../modal"
import {
  Button,
  Text,
  Input,
  toast,
  clx,
  Badge,
  Skeleton,
} from "@medusajs/ui"
import {
  Photo,
  MagnifyingGlass,
  Spinner,
  ArrowUpTray,
  CheckCircleSolid,
  ChevronLeft,
  ChevronRight,
} from "@medusajs/icons"

type MediaFile = {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
}

type PaginationInfo = {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

const DEFAULT_LIMIT = 20

type MediaPickerDialogProps = {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog should close (with selected URLs if multiple) */
  onClose: (selectedUrls?: string[]) => void
  /** Callback when an image is selected (for single mode) */
  onSelect: (url: string) => void
  /** Currently selected image URL */
  selectedUrl?: string | null
  /** Whether to allow multiple selection */
  multiple?: boolean
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
  multiple = false,
}: MediaPickerDialogProps) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(selectedUrl ? [selectedUrl] : [])
  )
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: DEFAULT_LIMIT,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [debouncedSearch])

  // Fetch media files with pagination
  const fetchFiles = useCallback(async (page: number = 1, search: string = "") => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: DEFAULT_LIMIT.toString(),
      })
      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`${backendUrl}/admin/media?${params.toString()}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Medya listesi alınamadı")
      const data = await response.json()
      setFiles(data.files || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
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
      fetchFiles(1, "")
      setSearchQuery("")
      setDebouncedSearch("")
      setPagination((prev) => ({ ...prev, page: 1 }))
      setSelectedUrls(new Set(selectedUrl ? [selectedUrl] : []))
    }
  }, [open, fetchFiles, selectedUrl])

  // Fetch files when page or search changes
  useEffect(() => {
    if (open) {
      fetchFiles(pagination.page, debouncedSearch)
    }
  }, [open, pagination.page, debouncedSearch, fetchFiles])

  // Pagination handlers
  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
    }
  }

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
    }
  }

  const handlePageClick = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  // Handle multiple file upload using /admin/uploads endpoint
  const handleMultipleFileUpload = useCallback(
    async (filesToUpload: File[]) => {
      // Validate files
      const validFiles: File[] = []
      for (const file of filesToUpload) {
        if (!file.type.startsWith("image/")) {
          toast.error("Hata", { description: `${file.name}: Geçerli bir resim dosyası değil` })
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error("Hata", { description: `${file.name}: 10MB'dan büyük` })
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0) return

      setUploading(true)
      try {
        // Create FormData for /admin/uploads endpoint
        const formData = new FormData()
        
        for (const file of validFiles) {
          formData.append("files", file)
        }

        const response = await fetch(`${backendUrl}/admin/uploads`, {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || "Resimler yüklenemedi")
        }

        const data = await response.json()
        
        // /admin/uploads returns { files: [{ id, url }] }
        const uploadedFiles: MediaFile[] = (data.files || []).map((f: any, index: number) => ({
          id: f.id || `uploaded-${Date.now()}-${index}`,
          filename: validFiles[index]?.name || `image-${index}`,
          url: f.url,
          size: validFiles[index]?.size || 0,
          mimeType: validFiles[index]?.type || "image/jpeg",
          createdAt: new Date().toISOString(),
        }))

        // Upload sonrası ilk sayfaya dön ve listeyi yenile
        setPagination((prev) => ({ ...prev, page: 1 }))
        await fetchFiles(1, debouncedSearch)
        toast.success("Başarılı", { 
          description: `${uploadedFiles.length} resim yüklendi` 
        })
      } catch (error: any) {
        toast.error("Hata", {
          description: error.message || "Resimler yüklenirken hata oluştu",
        })
      } finally {
        setUploading(false)
      }
    },
    [fetchFiles, debouncedSearch]
  )

  // Handle file input change (supports multiple files)
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList && fileList.length > 0) {
      const filesArray = Array.from(fileList)
      handleMultipleFileUpload(filesArray)
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
      const filesArray = Array.from(droppedFiles)
      handleMultipleFileUpload(filesArray)
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | "...")[] = []
    const { page, totalPages } = pagination

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages)
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages)
      }
    }
    return pages
  }

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
              multiple={true}
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
          {pagination.totalCount > 0 && (
            <div className="mt-3 flex items-center gap-x-2">
              <Badge color="grey" size="2xsmall">
                {pagination.totalCount} resim
              </Badge>
              {debouncedSearch && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  "{debouncedSearch}" için sonuçlar
                </Text>
              )}
              {pagination.totalPages > 1 && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  • Sayfa {pagination.page}/{pagination.totalPages}
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
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ui-bg-component mb-4">
                <Photo className="h-8 w-8 text-ui-fg-muted" />
              </div>
              <Text size="small" weight="plus" className="text-ui-fg-base mb-1">
                {debouncedSearch ? "Sonuç bulunamadı" : "Henüz resim yüklenmedi"}
              </Text>
              {!debouncedSearch && (
                <Text size="xsmall" className="text-ui-fg-subtle max-w-sm">
                  Resim yüklemek için yukarıdaki "Yükle" butonunu kullanın veya
                  dosyaları buraya sürükleyip bırakın
                </Text>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => {
                const isSelected = multiple 
                  ? selectedUrls.has(file.url)
                  : selectedUrl === file.url
                return (
                  <div
                    key={file.id}
                    className={clx(
                      "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                      isSelected
                        ? "border-ui-fg-interactive ring-2 ring-ui-fg-interactive/20 shadow-elevation-card"
                        : "border-ui-border-base hover:border-ui-border-strong hover:shadow-elevation-card"
                    )}
                    onClick={() => {
                      if (multiple) {
                        const newSelected = new Set(selectedUrls)
                        if (newSelected.has(file.url)) {
                          newSelected.delete(file.url)
                        } else {
                          newSelected.add(file.url)
                        }
                        setSelectedUrls(newSelected)
                      } else {
                        onSelect(file.url)
                        onClose()
                      }
                    }}
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

          {/* Pagination */}
          {pagination.totalPages > 1 && !loading && (
            <div className="flex items-center justify-center gap-x-1 mt-6 pt-4 border-t border-ui-border-base">
              <Button
                variant="transparent"
                size="small"
                onClick={handlePrevPage}
                disabled={!pagination.hasPrevPage}
                className="p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-x-1">
                {getPageNumbers().map((pageNum, idx) =>
                  pageNum === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-ui-fg-muted"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? "primary" : "transparent"}
                      size="small"
                      onClick={() => handlePageClick(pageNum)}
                      className={clx(
                        "min-w-[32px] h-8",
                        pagination.page === pageNum && "pointer-events-none"
                      )}
                    >
                      {pageNum}
                    </Button>
                  )
                )}
              </div>

              <Button
                variant="transparent"
                size="small"
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage}
                className="p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onClose()}>
          İptal
        </Button>
        {multiple ? (
          <Button
            variant="primary"
            onClick={() => {
              if (selectedUrls.size > 0) {
                onClose(Array.from(selectedUrls))
              } else {
                onClose()
              }
            }}
            disabled={selectedUrls.size === 0}
          >
            {selectedUrls.size > 0 ? `${selectedUrls.size} Seçili` : "Seç"}
          </Button>
        ) : (
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
        )}
      </ModalFooter>
    </Modal>
  )
}
