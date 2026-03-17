import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Helper: Parse query param arrays (e.g., category_id[0], category_id[1] -> category_id: [..])
 */
function parseArrayQuery(query: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const k in query) {
    let match = k.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/)
    if (match) {
      const key = match[1]
      out[key] = out[key] || []
      out[key][match[2] as any] = query[k]
    } else {
      out[k] = query[k]
    }
  }
  return out
}

// Returns the allowed product relation names only
function getAllowedProductRelations(inputRelations: string[]): string[] {
  // Extend this array with any other valid product relation names
  const allowed = [
    "variants",
    "tags",
    "images",
    "type",
    "collection",
    "options",
    // "brand" REMOVED - brand is a link, not a relation!
    // "sales_channels" REMOVED since it's not a valid relation on Product!
  ]
  // Only keep allowed relations
  return inputRelations.filter(r => allowed.includes(r))
}

// GET /admin/products - Ürünleri filtreli, seçenekli döndür
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productService = req.scope.resolve(Modules.PRODUCT)

  // Parse url-like arrays (e.g., category_id[0])
  const parsedQuery = parseArrayQuery(req.query as Record<string, any>)

  // Pagination
  const limit = parseInt(parsedQuery.limit as string) || 20
  const offset = parseInt(parsedQuery.offset as string) || 0

  // General search
  const search = (parsedQuery.q as string) || ""

  // Brand filters
  const hasBrand = parsedQuery.has_brand as string // "true", "false", veya undefined
  const excludeBrandId = parsedQuery.exclude_brand_id as string

  /**
   * 1. FILTERS: Derive from parsedQuery keys like 'category_id', 'collection_id', etc.
   * 2. SELECT: Build select array from parsedQuery.fields like 'id,title,...'
   * 3. RELATIONS: Build from 'fields' that include '*' or relation names
   */

  // Pull out fields param, e.g. "fields=id,title,handle,status,*collection,*sales_channels,variants.id,thumbnail,-type,-options,-tags,-images,-variants"
  let fields = typeof parsedQuery.fields === "string" ? parsedQuery.fields.split(",") : []

  // Build Medusa select array
  let select: string[] = []
  let relations: string[] = []
  let excludes: Set<string> = new Set()

  if (fields && fields.length > 0) {
    for (const f of fields) {
      if (!f || f === "-") continue
      if (f.startsWith("-")) {
        // Exclude
        excludes.add(f.slice(1))
      } else if (f.startsWith("*")) {
        // Relation fully
        relations.push(f.replace(/^\*/, ""))
      } else if (f.includes(".")) {
        // Nested relation field (e.g., variants.id)
        const parts = f.split(".")
        relations.push(parts[0])
        // select.push(f) // don't add nested to select, only main model fields
      } else {
        // Field select (main product table)
        select.push(f)
      }
    }
  } else {
    // Default fields (as Medusa admin would return, without sales_channels)
    select = ["id", "title", "handle", "status", "thumbnail"]
    relations = ["variants"]
  }

  // Remove excluded fields from select/relations
  if (excludes.size > 0) {
    select = select.filter(f => !excludes.has(f))
    relations = relations.filter(r => !excludes.has(r))
  }

  // Remove sales_channels (and any other invalid relation) from relations, just in case
  relations = getAllowedProductRelations(relations)

  // Key predicate for filterable fields (collection_id, tags, etc)
  let filters: Record<string, any> = {}
  for (const key in parsedQuery) {
    if (
      [
        "limit",
        "offset",
        "fields",
        "q",
        "has_brand",
        "exclude_brand_id",
        "category_id" // EXCLUDE category_id from product filters!
      ].includes(key)
    ) {
      continue
    }
    let val = parsedQuery[key]
    if (Array.isArray(val)) val = val.filter(Boolean)
    filters[key] = val
  }
  if (search) {
    filters.q = search
  }

  // GET products (with filters, custom select, and relations)
  let products: any[] = []
  let count: number = 0

  // Special handling: if category_id is provided, use query.graph to get products in that category first
  // and filter by those ids; otherwise, proceed normally
  let categoryIds: string[] | undefined
  if (parsedQuery.category_id) {
    categoryIds = Array.isArray(parsedQuery.category_id)
      ? parsedQuery.category_id.filter(Boolean)
      : [parsedQuery.category_id].filter(Boolean)

    let productIds: string[] = []
    if (categoryIds.length > 0) {
      // Query graph to retrieve all product ids belonging to these categories
      // graph: entity = "product", filters: { categories: { id: categoryIds } }
      const { data: productsInCategories } = await query.graph({
        entity: "product",
        filters: { categories: { id: categoryIds } } as any,
        fields: ["id"],
      })
      productIds = productsInCategories.map((p: { id: string }) => p.id)
    }
    // If no product ids matched category, return empty result directly
    if (categoryIds.length === 0 || productIds.length === 0) {
      res.json({
        products: [],
        count: 0,
        limit,
        offset,
      })
      return
    }
    // Only return products with these ids, along with other filters
    filters.id = productIds
  }

  const result = await productService.listAndCountProducts(
    filters,
    {
      skip: offset,
      take: limit,
      select: select.length > 0 ? select : undefined,
      relations: relations.length > 0 ? relations : undefined,
    }
  )
  products = result[0]
  count = result[1]

  // Brand bilgisini Query Graph ile getir (if needed)
  let productsWithBrand = products
  if (hasBrand !== undefined || excludeBrandId !== undefined) {
    const productIds = products.map((p: { id: string }) => p.id)
    if (productIds.length > 0) {
      try {
        const { data: productsData } = await query.graph({
          entity: "product",
          fields: ["id", "brand.*"],
          filters: { id: productIds },
        })
        const brandMap = new Map(
          productsData.map(
            (p: { id: string; brand?: { id: string; name: string } | null }) => [p.id, p.brand]
          )
        )
        productsWithBrand = products.map((p: Record<string, unknown>) => ({
          ...p,
          brand: brandMap.get(p.id as string) || null,
        }))
        // Brand filterle
        if (hasBrand === "false") {
          productsWithBrand = productsWithBrand.filter((p: Record<string, unknown>) => !p.brand)
        } else if (hasBrand === "true") {
          productsWithBrand = productsWithBrand.filter((p: Record<string, unknown>) => !!p.brand)
        }
        if (excludeBrandId) {
          productsWithBrand = productsWithBrand.filter(
            (p: Record<string, unknown>) => {
              const brand = p.brand as Record<string, unknown> | null
              return !brand || brand.id !== excludeBrandId
            }
          )
        }
      } catch (err) {
        // Link henüz oluşturulmamışsa veya hata varsa, brand filtresi olmadan devam et
        console.error("Brand link query failed:", err instanceof Error ? err.message : err)
      }
    }
  }

  res.json({
    products: productsWithBrand,
    count,
    limit,
    offset,
  })
}
