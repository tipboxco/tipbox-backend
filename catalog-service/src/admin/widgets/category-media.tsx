import { useEffect, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps } from "@medusajs/framework/types"
import { MediaWidget, type MediaWidgetConfig } from "../components/media"

type CategoryMediaWidgetProps = DetailWidgetProps<{
  id: string
  name: string
  handle: string
  metadata?: Record<string, any>
}>

const CategoryMediaWidget = ({ data }: CategoryMediaWidgetProps) => {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading if needed
    setLoading(false)
  }, [data])

  const widgetConfig: MediaWidgetConfig = {
    entityType: "category",
    entityId: data.id,
    metadata: data.metadata,
    updateEndpoint: "/admin/categories/:id/metadata",
    successMessage: "Kategori medya bilgileri güncellendi",
    errorMessagePrefix: "Kategori medya",
    fields: [
      {
        key: "thumb_image",
        label: "Küçük Resim (Thumb)",
        previewHeight: 32,
      },
      {
        key: "banner_image",
        label: "Banner Resmi",
        previewHeight: 48,
      },
    ],
  }

  return <MediaWidget config={widgetConfig} loading={loading} />
}

export const config = defineWidgetConfig({
  zone: "product_category.details.side.before",
})

export default CategoryMediaWidget

