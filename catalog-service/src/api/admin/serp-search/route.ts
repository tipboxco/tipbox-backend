import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type SerpResult = {
  title: string
  price?: string
  image?: string
  link?: string
  source?: string
  rating?: number
  reviews?: number
}

type SerpApiShoppingResult = {
  title?: string
  price?: string
  thumbnail?: string
  link?: string
  source?: string
  rating?: number
  reviews?: number
}

type SerperShoppingResult = {
  title?: string
  price?: string
  imageUrl?: string
  link?: string
  source?: string
  rating?: number
  ratingCount?: number
}

type ImportRequestBody = {
  brand_id: string
  products: SerpResult[]
}

/** Benzersiz handle üret: title → lowercase-slug + timestamp + random */
function generateHandle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${slug}-${Date.now().toString(36)}-${rand}`
}

/**
 * SerpAPI tbs (to-be-searched) filtre stringi oluştur.
 * Desteklenen filtreler:
 *   - price_min / price_max → tbs=mr:1,price:1,ppr_min:{min},ppr_max:{max}
 *   - sort_by: "price_low" → tbs=p_ord:p, "price_high" → tbs=p_ord:pd, "rating" → tbs=p_ord:r
 */
function buildTbs(params: {
  priceMin?: string
  priceMax?: string
  sortBy?: string
}): string | undefined {
  const parts: string[] = []

  if (params.priceMin || params.priceMax) {
    parts.push("mr:1", "price:1")
    if (params.priceMin) parts.push(`ppr_min:${params.priceMin}`)
    if (params.priceMax) parts.push(`ppr_max:${params.priceMax}`)
  }

  const sortMap: Record<string, string> = {
    price_low: "p_ord:p",
    price_high: "p_ord:pd",
    rating: "p_ord:r",
    reviews: "p_ord:rv",
  }
  if (params.sortBy && sortMap[params.sortBy]) {
    parts.push(sortMap[params.sortBy])
  }

  return parts.length > 0 ? parts.join(",") : undefined
}

/**
 * GET /admin/serp-search
 *
 * Query params:
 *   q          – required, search query (supports inline Google operators e.g. "brand:apple macbook")
 *   source     – "serpapi" | "serper" (default: "serpapi")
 *   gl         – country code e.g. "us", "tr", "gb" (default: "us")
 *   hl         – language code e.g. "en", "tr", "de" (default: "en")
 *   num        – result count: 10 | 20 | 40 | 100 (default: 20)
 *   price_min  – minimum price (SerpAPI only)
 *   price_max  – maximum price (SerpAPI only)
 *   sort_by    – "relevance" | "price_low" | "price_high" | "rating" | "reviews" (SerpAPI only)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = req.query.q as string
  const source = (req.query.source as string) || "serpapi"
  const gl = (req.query.gl as string) || "us"
  const hl = (req.query.hl as string) || "en"
  const num = (req.query.num as string) || "20"
  const priceMin = req.query.price_min as string | undefined
  const priceMax = req.query.price_max as string | undefined
  const sortBy = req.query.sort_by as string | undefined

  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Query parametresi gerekli" })
  }

  try {
    let results: SerpResult[] = []

    if (source === "serpapi") {
      const apiKey = process.env.SERPAPI_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: "SERPAPI_API_KEY environment variable tanımlı değil" })
      }

      const searchParams: Record<string, string> = {
        engine: "google_shopping_light",
        q: q.trim(),
        api_key: apiKey,
        gl,
        hl,
        num,
      }

      const tbs = buildTbs({ priceMin, priceMax, sortBy })
      if (tbs) searchParams.tbs = tbs

      const response = await fetch(
        `https://serpapi.com/search.json?${new URLSearchParams(searchParams)}`
      )
      if (!response.ok) {
        const text = await response.text()
        return res.status(502).json({ error: `SerpAPI hatası: ${response.status}`, details: text })
      }

      const data = (await response.json()) as { shopping_results?: SerpApiShoppingResult[] }
      const shoppingResults: SerpApiShoppingResult[] = data.shopping_results || []

      results = shoppingResults.map((item) => ({
        title: item.title || "",
        price: item.price,
        image: item.thumbnail,
        link: item.link,
        source: item.source,
        rating: item.rating,
        reviews: item.reviews,
      }))
    } else if (source === "serper") {
      const apiKey = process.env.SERPER_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: "SERPER_API_KEY environment variable tanımlı değil" })
      }

      const body: Record<string, string | number> = {
        q: q.trim(),
        gl,
        hl,
        num: parseInt(num) || 20,
      }

      const response = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const text = await response.text()
        return res.status(502).json({ error: `Serper API hatası: ${response.status}`, details: text })
      }

      const data = (await response.json()) as { shopping?: SerperShoppingResult[] }
      const shoppingResults: SerperShoppingResult[] = data.shopping || []

      results = shoppingResults.map((item) => ({
        title: item.title || "",
        price: item.price,
        image: item.imageUrl,
        link: item.link,
        source: item.source,
        rating: item.rating,
        reviews: item.ratingCount,
      }))
    } else {
      return res.status(400).json({ error: "Geçersiz source. 'serpapi' veya 'serper' olmalı." })
    }

    return res.json({
      results,
      count: results.length,
      source,
      query: q.trim(),
      filters: { gl, hl, num, price_min: priceMin, price_max: priceMax, sort_by: sortBy },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    console.error("SERP search error:", message)
    return res.status(500).json({ error: "Arama sırasında hata oluştu", message })
  }
}

/**
 * POST /admin/serp-search
 * Seçilen SERP sonuçlarını Medusa product olarak oluştur + brand'e bağla.
 *
 * Body: { brand_id: string, products: SerpResult[] }
 */
export const POST = async (req: MedusaRequest<ImportRequestBody>, res: MedusaResponse) => {
  const { brand_id, products } = req.body

  if (!brand_id) {
    return res.status(400).json({ error: "brand_id gerekli" })
  }
  if (!products || products.length === 0) {
    return res.status(400).json({ error: "En az bir ürün seçilmeli" })
  }

  const productService = req.scope.resolve(Modules.PRODUCT)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const results: Array<{ title: string; product_id?: string; success: boolean; error?: string }> =
    []

  for (const item of products) {
    try {
      // Yeni ürün oluştur (benzersiz handle ile)
      const created = await productService.createProducts([
        {
          title: item.title,
          handle: generateHandle(item.title),
          status: "draft" as const,
          thumbnail: item.image ?? undefined,
          metadata: {
            serp_price: item.price ?? null,
            serp_link: item.link ?? null,
            serp_source: item.source ?? null,
            serp_rating: item.rating ?? null,
            serp_reviews: item.reviews ?? null,
          },
        },
      ])

      const newProduct = created[0]

      // Mevcut brand link'ini kontrol et ve varsa kaldır (güvenli pattern)
      const { data: productData } = await query.graph({
        entity: "product",
        fields: ["id", "brand.id"],
        filters: { id: newProduct.id },
      })

      const existingBrand = productData[0]?.brand as Record<string, unknown> | undefined | null
      if (existingBrand?.id) {
        await remoteLink.dismiss({
          [Modules.PRODUCT]: { product_id: newProduct.id },
          brand: { brand_id: existingBrand.id as string },
        })
      }

      // Brand ile link oluştur
      await remoteLink.create({
        [Modules.PRODUCT]: { product_id: newProduct.id },
        brand: { brand_id },
      })

      results.push({ title: item.title, product_id: newProduct.id, success: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata"
      console.error(`SERP import hatası (${item.title}):`, message)
      results.push({ title: item.title, success: false, error: message })
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return res.json({
    success: failCount === 0,
    brand_id,
    total: products.length,
    successful: successCount,
    failed: failCount,
    results,
  })
}
