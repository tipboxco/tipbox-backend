import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Desteklenen webhook eventleri
 */
const SUPPORTED_EVENTS = [
  {
    name: "product.created",
    description: "Yeni bir ürün oluşturulduğunda tetiklenir",
    category: "product",
  },
  {
    name: "product.updated",
    description: "Bir ürün güncellendiğinde tetiklenir",
    category: "product",
  },
  {
    name: "product.deleted",
    description: "Bir ürün silindiğinde tetiklenir",
    category: "product",
  },
  {
    name: "product-category.created",
    description: "Yeni bir kategori oluşturulduğunda tetiklenir",
    category: "category",
  },
  {
    name: "product-category.updated",
    description: "Bir kategori güncellendiğinde tetiklenir",
    category: "category",
  },
  {
    name: "product-category.deleted",
    description: "Bir kategori silindiğinde tetiklenir",
    category: "category",
  },
  {
    name: "order.placed",
    description: "Yeni bir sipariş verildiğinde tetiklenir",
    category: "order",
  },
  {
    name: "order.updated",
    description: "Bir sipariş güncellendiğinde tetiklenir",
    category: "order",
  },
  {
    name: "order.completed",
    description: "Bir sipariş tamamlandığında tetiklenir",
    category: "order",
  },
  {
    name: "order.canceled",
    description: "Bir sipariş iptal edildiğinde tetiklenir",
    category: "order",
  },
  {
    name: "customer.created",
    description: "Yeni bir müşteri oluşturulduğunda tetiklenir",
    category: "customer",
  },
  {
    name: "customer.updated",
    description: "Bir müşteri güncellendiğinde tetiklenir",
    category: "customer",
  },
  {
    name: "brand.created",
    description: "Yeni bir marka oluşturulduğunda tetiklenir",
    category: "brand",
  },
  {
    name: "brand.updated",
    description: "Bir marka güncellendiğinde tetiklenir",
    category: "brand",
  },
  {
    name: "brand.deleted",
    description: "Bir marka silindiğinde tetiklenir",
    category: "brand",
  },
]

/**
 * GET /admin/webhooks/events
 * Desteklenen webhook eventlerini listeler
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { category } = req.query

  let events = SUPPORTED_EVENTS

  if (category && typeof category === "string") {
    events = events.filter((event) => event.category === category)
  }

  // Kategorilere göre grupla
  const groupedEvents = events.reduce(
    (acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = []
      }
      acc[event.category].push(event)
      return acc
    },
    {} as Record<string, typeof events>
  )

  res.json({
    events,
    grouped_events: groupedEvents,
    categories: [...new Set(SUPPORTED_EVENTS.map((e) => e.category))],
    count: events.length,
  })
}

