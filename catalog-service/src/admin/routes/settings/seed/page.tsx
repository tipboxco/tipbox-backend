import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { backendUrl } from "../../../lib/config"
import {
  Container,
  Heading,
  Table,
  Button,
  Text,
  toast,
  Badge,
  Input,
  Label,
  DropdownMenu,
} from "@medusajs/ui"
import {
  AcademicCapSolid as Database,
  CheckCircleSolid,
  XCircleSolid,
  ArrowPath,
  Trash,
  EllipsisHorizontal,
  Spinner,
} from "@medusajs/icons"
import { Modal, ModalBody, ModalFooter } from "../../../components/modal"

type SeedDataInfo = {
  categories: {
    count: number
    file_exists: boolean
  }
  brands: {
    count: number
    file_exists: boolean
  }
  products: {
    count: number
    file_exists: boolean
  }
}

type SeedStatus = {
  categories: "idle" | "installing" | "success" | "error"
  brands: "idle" | "installing" | "success" | "error"
  products: "idle" | "installing" | "success" | "error"
}

const SeedPage = () => {
  const [seedData, setSeedData] = useState<SeedDataInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SeedStatus>({
    categories: "idle",
    brands: "idle",
    products: "idle",
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteType, setDeleteType] = useState<"categories" | "brands" | "products" | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

  const fetchSeedData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${backendUrl}/admin/seed`, { credentials: "include" })
      const data = await response.json()
      setSeedData(data.seed_data)
    } catch (error) {
      console.error("Seed verileri yüklenirken hata:", error)
      toast.error("Hata", {
        description: "Seed verileri yüklenirken bir hata oluştu",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeedData()
  }, [])

  const handleInstall = async (type: "categories" | "brands" | "products") => {
    setStatus((prev) => ({ ...prev, [type]: "installing" }))

    try {
      const response = await fetch(`${backendUrl}/admin/seed/${type}`, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(600_000), // 10 dakika timeout
      })

      const data = await response.json()

      if (response.ok) {
        setStatus((prev) => ({ ...prev, [type]: "success" }))
        toast.success("Başarılı", {
          description: data.message || `${type} başarıyla yüklendi`,
        })
      } else {
        setStatus((prev) => ({ ...prev, [type]: "error" }))
        toast.error("Hata", {
          description: data.error || `${type} yüklenirken bir hata oluştu`,
        })
      }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError"
      setStatus((prev) => ({ ...prev, [type]: "error" }))
      toast.error(isTimeout ? "Zaman Aşımı" : "Hata", {
        description: isTimeout
          ? `${type} yükleme işlemi çok uzun sürdü. İşlem arka planda devam ediyor olabilir.`
          : `${type} yüklenirken bir hata oluştu`,
      })
    }
  }

  const getStatusIcon = (type: keyof SeedStatus) => {
    const currentStatus = status[type]
    
    if (currentStatus === "installing") {
      return <Spinner className="animate-spin h-4 w-4 text-ui-fg-interactive" />
    }
    if (currentStatus === "success") {
      return <CheckCircleSolid className="h-4 w-4 text-emerald-500" />
    }
    if (currentStatus === "error") {
      return <XCircleSolid className="h-4 w-4 text-red-500" />
    }
    return null
  }

  const getStatusBadge = (type: keyof SeedStatus) => {
    const currentStatus = status[type]
    
    if (currentStatus === "installing") {
      return <Badge color="blue" size="small">Yükleniyor...</Badge>
    }
    if (currentStatus === "success") {
      return <Badge color="green" size="small">Yüklendi</Badge>
    }
    if (currentStatus === "error") {
      return <Badge color="red" size="small">Hata</Badge>
    }
    return null
  }

  const isInstalling = Object.values(status).some(s => s === "installing")

  const getDeleteTypeLabel = (type: "categories" | "brands" | "products") => {
    switch (type) {
      case "categories":
        return "Kategoriler"
      case "brands":
        return "Markalar"
      case "products":
        return "Ürünler"
    }
  }

  const getDeleteConfirmText = (type: "categories" | "brands" | "products") => {
    switch (type) {
      case "categories":
        return "KATEGORİLER"
      case "brands":
        return "MARKALAR"
      case "products":
        return "ÜRÜNLER"
    }
  }

  const handleDeleteClick = (type: "categories" | "brands" | "products") => {
    setDeleteType(type)
    setDeleteConfirmText("")
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteType) return
    
    const requiredText = getDeleteConfirmText(deleteType)
    if (deleteConfirmText !== requiredText) {
      toast.error("Hata", {
        description: `Lütfen "${requiredText}" yazın`,
      })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`${backendUrl}/admin/seed/${deleteType}`, {
        method: "DELETE",
        credentials: "include",
        signal: AbortSignal.timeout(600_000), // 10 dakika timeout
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Başarılı", {
          description: data.message || `${getDeleteTypeLabel(deleteType)} başarıyla silindi`,
        })
        setDeleteDialogOpen(false)
        setDeleteConfirmText("")
        setDeleteType(null)
        fetchSeedData()
      } else {
        toast.error("Hata", {
          description: data.error || `${getDeleteTypeLabel(deleteType)} silinirken bir hata oluştu`,
        })
      }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError"
      toast.error(isTimeout ? "Zaman Aşımı" : "Hata", {
        description: isTimeout
          ? `${getDeleteTypeLabel(deleteType)} silme işlemi çok uzun sürdü. İşlem arka planda devam ediyor olabilir.`
          : `${getDeleteTypeLabel(deleteType)} silinirken bir hata oluştu`,
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1" className="text-ui-fg-base">
              Seed Verileri
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Veritabanına seed datalarını yükleyin
            </Text>
          </div>
          <Button 
            variant="secondary" 
            size="small" 
            onClick={fetchSeedData}
            disabled={loading}
          >
            <ArrowPath className={loading ? "animate-spin" : ""} />
            Yenile
          </Button>
        </div>
      </Container>

      {/* Main Content */}
      <Container className="divide-y p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="animate-spin h-8 w-8 text-ui-fg-interactive" />
              <Text size="small" className="text-ui-fg-subtle">
                Yükleniyor...
              </Text>
            </div>
          </div>
        ) : !seedData ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-ui-bg-subtle rounded-full p-4 mb-4">
              <Database className="text-ui-fg-muted h-8 w-8" />
            </div>
            <Text weight="plus" className="text-ui-fg-base mb-1">
              Seed verileri bulunamadı
            </Text>
            <Text size="small" className="text-ui-fg-subtle mb-4 text-center max-w-sm">
              Seed verileri yüklenirken bir hata oluştu
            </Text>
            <Button variant="secondary" size="small" onClick={fetchSeedData}>
              <ArrowPath />
              Tekrar Dene
            </Button>
          </div>
        ) : (
          <div className="px-0">
            <Table>
              <Table.Header>
                <Table.Row className="bg-ui-bg-subtle">
                  <Table.HeaderCell className="pl-6">Tip</Table.HeaderCell>
                  <Table.HeaderCell>Dosya Durumu</Table.HeaderCell>
                  <Table.HeaderCell>Kayıt Sayısı</Table.HeaderCell>
                  <Table.HeaderCell>Durum</Table.HeaderCell>
                  <Table.HeaderCell className="w-[150px]"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {/* Categories Row */}
                <Table.Row>
                  <Table.Cell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                        <Database className="text-ui-fg-subtle h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <Text weight="plus" size="small" className="text-ui-fg-base">
                          Kategoriler
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          Product Categories
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {seedData.categories.file_exists ? (
                      <Badge color="green" size="small">
                        <CheckCircleSolid className="h-3 w-3 mr-1" />
                        Mevcut
                      </Badge>
                    ) : (
                      <Badge color="red" size="small">
                        <XCircleSolid className="h-3 w-3 mr-1" />
                        Bulunamadı
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-base">
                      {seedData.categories.count.toLocaleString()} kayıt
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge("categories")}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handleInstall("categories")}
                      disabled={isInstalling || !seedData.categories.file_exists}
                    >
                      {status.categories === "installing" ? (
                        <>
                          <Spinner className="animate-spin h-3 w-3 mr-1" />
                          Yükleniyor...
                        </>
                      ) : (
                        <>
                          {getStatusIcon("categories")}
                          Install
                        </>
                      )}
                    </Button>
                  </Table.Cell>
                </Table.Row>

                {/* Brands Row */}
                <Table.Row>
                  <Table.Cell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                        <Database className="text-ui-fg-subtle h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <Text weight="plus" size="small" className="text-ui-fg-base">
                          Markalar
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          Brands
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {seedData.brands.file_exists ? (
                      <Badge color="green" size="small">
                        <CheckCircleSolid className="h-3 w-3 mr-1" />
                        Mevcut
                      </Badge>
                    ) : (
                      <Badge color="red" size="small">
                        <XCircleSolid className="h-3 w-3 mr-1" />
                        Bulunamadı
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-base">
                      {seedData.brands.count.toLocaleString()} kayıt
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge("brands")}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handleInstall("brands")}
                      disabled={isInstalling || !seedData.brands.file_exists}
                    >
                      {status.brands === "installing" ? (
                        <>
                          <Spinner className="animate-spin h-3 w-3 mr-1" />
                          Yükleniyor...
                        </>
                      ) : (
                        <>
                          {getStatusIcon("brands")}
                          Install
                        </>
                      )}
                    </Button>
                  </Table.Cell>
                </Table.Row>

                {/* Products Row */}
                <Table.Row>
                  <Table.Cell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-component border border-ui-border-base">
                        <Database className="text-ui-fg-subtle h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <Text weight="plus" size="small" className="text-ui-fg-base">
                          Ürünler
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          Products
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {seedData.products.file_exists ? (
                      <Badge color="green" size="small">
                        <CheckCircleSolid className="h-3 w-3 mr-1" />
                        Mevcut
                      </Badge>
                    ) : (
                      <Badge color="red" size="small">
                        <XCircleSolid className="h-3 w-3 mr-1" />
                        Bulunamadı
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-base">
                      {seedData.products.count.toLocaleString()} kayıt
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge("products")}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handleInstall("products")}
                      disabled={isInstalling || !seedData.products.file_exists}
                    >
                      {status.products === "installing" ? (
                        <>
                          <Spinner className="animate-spin h-3 w-3 mr-1" />
                          Yükleniyor...
                        </>
                      ) : (
                        <>
                          {getStatusIcon("products")}
                          Install
                        </>
                      )}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </div>
        )}
      </Container>

      {/* Tehlikeli Bölge - Silme Ayarları */}
      <Container className="divide-y p-0 border-t-2 border-ui-border-error">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-ui-bg-error-subtle border border-ui-border-error">
                <XCircleSolid className="text-ui-fg-error h-4 w-4" />
              </div>
              <div>
                <Heading level="h2" className="text-ui-fg-base text-sm">
                  Tehlikeli Bölge
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                  Tüm verileri kalıcı olarak silin
                </Text>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="transparent" size="small">
                  <EllipsisHorizontal />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item 
                  onClick={() => handleDeleteClick("categories")}
                  className="text-ui-fg-error"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Tüm Kategorileri Sil
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => handleDeleteClick("brands")}
                  className="text-ui-fg-error"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Tüm Markaları Sil
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => handleDeleteClick("products")}
                  className="text-ui-fg-error"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Tüm Ürünleri Sil
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      </Container>

      {/* Delete Confirmation Dialog */}
      <Modal
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setDeleteConfirmText("")
          setDeleteType(null)
        }}
        title="Verileri Sil"
        size="md"
      >
        <ModalBody className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-ui-bg-error-subtle rounded-md border border-ui-border-error">
            <XCircleSolid className="text-ui-fg-error h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <Text weight="plus" size="small" className="text-ui-fg-error mb-1">
                Bu işlem geri alınamaz!
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Tüm {deleteType && getDeleteTypeLabel(deleteType).toLowerCase()} kalıcı olarak silinecektir. 
                Bu işlemi onaylamak için aşağıya <strong>"{deleteType && getDeleteConfirmText(deleteType)}"</strong> yazın.
              </Text>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirm" weight="plus">
              Onay Metni
            </Label>
            <Input
              id="delete-confirm"
              placeholder={deleteType ? getDeleteConfirmText(deleteType) : ""}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="font-mono"
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Lütfen <strong>"{deleteType && getDeleteConfirmText(deleteType)}"</strong> yazın
            </Text>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmText("")
                setDeleteType(null)
              }}
              disabled={deleting}
            >
              İptal
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmText !== (deleteType ? getDeleteConfirmText(deleteType) : "")}
            >
              {deleting ? (
                <>
                  <Spinner className="animate-spin h-4 w-4 mr-2" />
                  Siliniyor...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Sil
                </>
              )}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Seed Verileri",
  icon: Database,
})

export default SeedPage

