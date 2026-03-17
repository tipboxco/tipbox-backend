import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Helper: Parse query param arrays (e.g., filters[0], filters[1] -> filters: [..])
 */
function parseArrayQuery(query: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k in query) {
    const match = k.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/)
    if (match) {
      const key = match[1]
      if (!Array.isArray(out[key])) out[key] = []
      ;(out[key] as unknown[])[parseInt(match[2])] = query[k]
    } else {
      out[k] = query[k]
    }
  }
  return out
}

/**
 * Tüm alt kategori ID'lerini BFS ile bul — TÜM kategorileri tek seferde yükleyip
 * birden fazla parent için aynı map üzerinden çalışır
 */
async function getAllChildCategoryIdsForParents(
  query: { graph: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }> },
  parentCategoryIds: string[]
): Promise<string[]> {
  if (parentCategoryIds.length === 0) return []

  try {
    // Tüm kategorileri TEK SEFERDE yükle (loop içinde değil)
    const { data: allCategories } = await query.graph({
      entity: "product_category",
      fields: ["id", "parent_category.id"],
      filters: {},
    })

    // Parent-child map oluştur
    const parentChildMap = new Map<string, string[]>()
    for (const cat of allCategories || []) {
      const parentId = (cat.parent_category as Record<string, unknown>)?.id as string | undefined
      if (parentId) {
        if (!parentChildMap.has(parentId)) parentChildMap.set(parentId, [])
        parentChildMap.get(parentId)!.push(cat.id as string)
      }
    }

    // Tüm parent'lar için tek BFS
    const allCategoryIds = new Set<string>(parentCategoryIds)
    const toProcess = [...parentCategoryIds]

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!
      const children = parentChildMap.get(currentId) || []
      for (const childId of children) {
        if (!allCategoryIds.has(childId)) {
          allCategoryIds.add(childId)
          toProcess.push(childId)
        }
      }
    }

    return Array.from(allCategoryIds)
  } catch (error) {
    console.warn("Alt kategori bulunamadı:", error)
    return parentCategoryIds
  }
}

/**
 * Birden fazla kategoriyi TEK SORGUDA getir (N+1 düzeltme)
 */
async function getCategoriesWithMetadata(
  query: { graph: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }> },
  categoryIds: string[]
): Promise<Record<string, unknown>[]> {
  if (categoryIds.length === 0) return []
  try {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle", "metadata", "parent_category.*"],
      filters: { id: categoryIds },
    })
    return categories || []
  } catch (error) {
    console.warn("Kategoriler bulunamadı:", error)
    return []
  }
}

// Utility: filterProductsByMetadata
function filterProductsByMetadata(products: Record<string, unknown>[], metadataFilters: Record<string, unknown>): Record<string, unknown>[] {
  if (!metadataFilters || Object.keys(metadataFilters).length === 0) return products
  return products.filter(p => {
    const m = (p.metadata || {}) as Record<string, unknown>
    for (const key in metadataFilters) {
      const value = metadataFilters[key]
      if (typeof value === "undefined" || value === null) continue
      const v = m[key]
      if (Array.isArray(value)) {
        if (v === undefined || v === null) return false
        if (Array.isArray(v)) {
          if (!v.some(item => (value as unknown[]).includes(item))) return false
        } else {
          if (!(value as unknown[]).includes(v)) return false
        }
      } else {
        if (Array.isArray(v)) {
          if (!v.includes(value)) return false
        } else {
          if (v !== value) return false
        }
      }
    }
    return true
  })
}

// Utility: searchInMetadata
function searchInMetadata(products: Record<string, unknown>[], search: string): Record<string, unknown>[] {
  if (!search || typeof search !== "string" || !search.trim()) return products
  const q = search.trim().toLowerCase()
  return products.filter(p => {
    if (typeof p.title === "string" && p.title.toLowerCase().includes(q)) return true
    const m = (p.metadata || {}) as Record<string, unknown>
    for (const key in m) {
      const val = m[key]
      if (typeof val === "string" && val.toLowerCase().includes(q)) return true
      if (typeof val === "number" && String(val).includes(q)) return true
      if (Array.isArray(val) && val.some(v => typeof v === "string" && v.toLowerCase().includes(q))) return true
      if (Array.isArray(val) && val.some(v => typeof v === "number" && String(v).includes(q))) return true
    }
    return false
  })
}

/**
 * Helper: Filterable metadata options oluştur (tekrarlanan kodu ortadan kaldırır)
 */
function buildMetadataOptions(
  products: Record<string, unknown>[],
  filteredProducts: Record<string, unknown>[],
  allowedFilterKeys: string[] | null
): Record<string, Array<{ value: unknown; count: number }>> {
  const metadataKeyValueMap = new Map<string, Set<string | number | boolean>>()
  for (const product of products) {
    const metadata = (product.metadata || {}) as Record<string, unknown>
    for (const key in metadata) {
      if (!key.startsWith("_") && key !== "filter_keys" && metadata[key] !== undefined && metadata[key] !== null) {
        const value = metadata[key]
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          if (!metadataKeyValueMap.has(key)) metadataKeyValueMap.set(key, new Set())
          metadataKeyValueMap.get(key)!.add(value)
        }
      }
    }
  }

  const metadataCounts: Record<string, Record<string, number>> = {}
  for (const product of filteredProducts) {
    const metadata = (product.metadata || {}) as Record<string, unknown>
    for (const key of metadataKeyValueMap.keys()) {
      if (metadata[key] !== undefined && metadata[key] !== null) {
        if (!metadataCounts[key]) metadataCounts[key] = {}
        const valueStr = String(metadata[key])
        metadataCounts[key][valueStr] = (metadataCounts[key][valueStr] || 0) + 1
      }
    }
  }

  let keysToUse: string[]
  if (allowedFilterKeys && allowedFilterKeys.length > 0) {
    keysToUse = allowedFilterKeys.filter(k => metadataKeyValueMap.has(k))
  } else {
    keysToUse = Array.from(metadataKeyValueMap.keys())
  }

  const result: Record<string, Array<{ value: unknown; count: number }>> = {}
  for (const key of keysToUse) {
    const valueSet = metadataKeyValueMap.get(key)
    if (!valueSet || valueSet.size === 0) continue
    const values = Array.from(valueSet)
    result[key] = values
      .map(value => ({
        value,
        count: metadataCounts[key]?.[String(value)] || 0,
      }))
      .filter(opt => opt.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return String(a.value).localeCompare(String(b.value))
      })
  }

  return result
}

/**
 * Helper: Category filter options oluştur (tekrarlanan kodu ortadan kaldırır)
 */
function buildCategoryOptions(
  filteredProducts: Record<string, unknown>[],
  availableCategories: Record<string, unknown>[] | null
): Array<{ id: string; name: string; handle: string; count: number }> {
  const categoryProductCounts = new Map<string, number>()
  const categoryIdSet = availableCategories
    ? new Set(availableCategories.map(c => c.id as string))
    : null

  for (const product of filteredProducts) {
    const productCategories = product.categories as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(productCategories)) continue
    const counted = new Set<string>()
    for (const cat of productCategories) {
      const catId = cat?.id as string | undefined
      if (!catId || counted.has(catId)) continue
      if (categoryIdSet && !categoryIdSet.has(catId)) continue
      categoryProductCounts.set(catId, (categoryProductCounts.get(catId) || 0) + 1)
      counted.add(catId)
    }
  }

  if (availableCategories) {
    return availableCategories
      .map(cat => ({
        id: cat.id as string,
        name: cat.name as string,
        handle: cat.handle as string,
        count: categoryProductCounts.get(cat.id as string) || 0,
      }))
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count)
  }

  return []
}

/**
 * Helper: Ürünlerden auto-discover category options (category_id parametresi yokken)
 */
async function buildAutoCategoryOptions(
  query: { graph: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }> },
  filteredProducts: Record<string, unknown>[]
): Promise<Array<{ id: string; name: string; handle: string; count: number }>> {
  const categoryIdSet = new Set<string>()
  for (const p of filteredProducts) {
    const cats = p.categories as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(cats)) continue
    for (const cat of cats) {
      if (cat?.id && typeof cat.id === "string") categoryIdSet.add(cat.id)
    }
  }

  if (categoryIdSet.size === 0) return []

  try {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle"],
      filters: { id: Array.from(categoryIdSet) },
    })

    return buildCategoryOptions(filteredProducts, categories || [])
  } catch {
    return []
  }
}

/**
 * GET /store/custom/filterable-products
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productService = req.scope.resolve(Modules.PRODUCT)

  // Parse query parameters
  const parsedQuery = parseArrayQuery(req.query as Record<string, unknown>)

  let categoryIdsArg: string[] = []
  if (parsedQuery.category_id !== undefined) {
    if (Array.isArray(parsedQuery.category_id)) {
      for (const item of parsedQuery.category_id) {
        if (typeof item === "string") {
          categoryIdsArg.push(...item.split(",").map(v => v.trim()).filter(Boolean))
        }
      }
    } else if (typeof parsedQuery.category_id === "string") {
      categoryIdsArg = parsedQuery.category_id.split(",").map(v => v.trim()).filter(Boolean)
    }
  }

  const brandId = parsedQuery.brand_id as string | undefined
  const search = (parsedQuery.q as string) || ""
  const limit = parseInt(parsedQuery.limit as string) || 20
  const offset = parseInt(parsedQuery.offset as string) || 0
  const includeFilters = parsedQuery.include_filters !== "false"

  // filter_keys
  let allowedFilterKeys: string[] | null = null
  if (parsedQuery.filter_keys) {
    const filterKeysParam = parsedQuery.filter_keys
    if (typeof filterKeysParam === "string") {
      allowedFilterKeys = filterKeysParam.split(",").map(k => k.trim()).filter(Boolean)
    } else if (Array.isArray(filterKeysParam)) {
      allowedFilterKeys = (filterKeysParam as string[]).map(k => String(k).trim()).filter(Boolean)
    }
  }
  if (!allowedFilterKeys) {
    const envKeys = process?.env?.FILTERABLE_METADATA_KEYS || ""
    if (envKeys && typeof envKeys === "string" && envKeys.trim()) {
      allowedFilterKeys = envKeys.split(",").map(k => k.trim()).filter(Boolean)
      if (allowedFilterKeys.length === 0) allowedFilterKeys = null
    }
  }

  // metadata.<key> parser
  const metadataFilters: Record<string, unknown> = {}
  let metadataBrandFilterVal: string | null = null
  for (const key in parsedQuery) {
    if (key.startsWith("metadata.")) {
      const metadataKey = key.replace("metadata.", "")
      const value = parsedQuery[key]
      metadataFilters[metadataKey] = Array.isArray(value) ? (value as unknown[]).filter(Boolean) : value
      if (metadataKey === "brand" && typeof value === "string") {
        metadataBrandFilterVal = value
      }
    }
  }

  let allProductIds: string[] = []
  let categoryIds: string[] = []
  let parentCategories: Record<string, unknown>[] = []
  let allCategories: Record<string, unknown>[] = []
  let brandDetail: Record<string, unknown> | null = null

  // --- Category-based filtering ---
  if (categoryIdsArg.length > 0) {
    // TEK SORGU ile tüm parent kategorileri çek (N+1 düzeltme)
    parentCategories = await getCategoriesWithMetadata(query, categoryIdsArg)

    // Eksik kategori kontrolü
    for (const singleCatId of categoryIdsArg) {
      if (!parentCategories.find(c => c.id === singleCatId)) {
        return res.status(404).json({
          error: `Kategori bulunamadı: ${singleCatId}`,
        })
      }
    }

    // TEK SEFERDE tüm alt kategori ID'lerini bul (loop kaldırıldı)
    categoryIds = await getAllChildCategoryIdsForParents(query, categoryIdsArg)

    // Kategori option bilgilerini çek
    if (categoryIds.length > 0) {
      try {
        const { data: categories } = await query.graph({
          entity: "product_category",
          fields: ["id", "name", "handle", "metadata"],
          filters: { id: categoryIds },
        })
        allCategories = categories || []
      } catch (error) {
        console.warn("Kategoriler getirilemedi:", error)
      }
    }

    // TEK SORGU ile tüm kategorilere ait ürün ID'lerini çek (N+1 düzeltme)
    if (categoryIds.length > 0) {
      try {
        const { data: productsInCategories } = await query.graph({
          entity: "product",
          fields: ["id"],
          filters: {
            categories: { id: categoryIds },
          } as Record<string, unknown>,
        })
        allProductIds = (productsInCategories || []).map((p: Record<string, unknown>) => p.id as string)
      } catch (error) {
        console.warn("Kategori ürünleri getirilemedi:", error)
      }
    }
  }

  // --- Brand-based filtering ---
  if (brandId) {
    try {
      const { data: brands } = await query.graph({
        entity: "brand",
        fields: ["id", "products.id", "name", "description", "metadata"],
        filters: { id: brandId },
      })

      const brand = brands?.[0]
      if (!brand) {
        return res.status(404).json({ error: "Brand bulunamadı" })
      }
      brandDetail = brand

      const brandProductIds = brand.products
        ? (Array.isArray(brand.products)
          ? (brand.products as Record<string, unknown>[]).map(p => p.id as string)
          : [(brand.products as Record<string, unknown>).id as string])
        : []

      // Category ile kesişim (intersection)
      if (categoryIdsArg.length > 0 && allProductIds.length > 0) {
        const brandIdSet = new Set(brandProductIds)
        allProductIds = allProductIds.filter(id => brandIdSet.has(id))
      } else {
        allProductIds = brandProductIds
      }
    } catch (error) {
      console.warn("Brand ürünleri getirilemedi:", error)
    }
  }

  // --- metadata.brand path (category yok, brand_id yok, metadata.brand var) ---
  if (categoryIdsArg.length === 0 && !brandId && metadataBrandFilterVal) {
    return await handleMetadataBrandPath(
      res, query, productService, metadataBrandFilterVal,
      metadataFilters, search, limit, offset, includeFilters,
      allowedFilterKeys, categoryIdsArg
    )
  }

  // --- No filter path ---
  if (categoryIdsArg.length === 0 && !brandId && !metadataBrandFilterVal) {
    return await handleNoFilterPath(
      res, query, productService, metadataFilters, search,
      limit, offset, includeFilters, allowedFilterKeys
    )
  }

  // --- Combined path (category ve/veya brand var) ---
  if (allProductIds.length === 0) {
    return res.json({
      products: [],
      count: 0,
      limit,
      offset,
      filterable_options: { categories: [], metadata: {} },
      ...(brandDetail ? { brand: brandDetail } : {}),
    })
  }

  // Ürün detayları — ana sorgu
  const productFilters: Record<string, unknown> = { id: allProductIds }
  for (const key in parsedQuery) {
    if (["category_id", "brand_id", "q", "limit", "offset", "include_filters", "filter_keys"].includes(key) || key.startsWith("metadata.")) {
      continue
    }
    const val = parsedQuery[key]
    if (val !== undefined && val !== null) {
      productFilters[key] = Array.isArray(val) ? (val as unknown[]).filter(Boolean) : val
    }
  }

  const MAX_PRODUCTS = 1000
  const productCount = allProductIds.length
  const [products] = await productService.listAndCountProducts(
    productFilters,
    {
      skip: 0,
      take: Math.min(productCount, MAX_PRODUCTS),
      relations: ["variants", "images", "categories"],
      select: ["id", "title", "handle", "status", "thumbnail", "metadata", "created_at", "updated_at"],
    }
  )

  // Brand bilgisini query.graph ile çek
  let productsWithBrand = products as unknown as Record<string, unknown>[]
  if (productsWithBrand.length > 0) {
    try {
      const productIds = productsWithBrand.map((p: Record<string, unknown>) => p.id as string)
      const { data: productsData } = await query.graph({
        entity: "product",
        fields: ["id", "brand.*"],
        filters: { id: productIds },
      })
      const brandMap = new Map(
        productsData.map((p: Record<string, unknown>) => [
          p.id,
          p.brand || null,
        ])
      )
      productsWithBrand = productsWithBrand.map((p: Record<string, unknown>) => ({
        ...p,
        brand: brandMap.get(p.id as string) || null,
      }))

      // Tek brand detayı
      if (!brandDetail) {
        const brandIdsInProducts = Array.from(
          new Set(productsWithBrand.map(p => (p.brand as Record<string, unknown>)?.id).filter(Boolean))
        )
        if (brandIdsInProducts.length === 1) {
          try {
            const { data: brands } = await query.graph({
              entity: "brand",
              fields: ["id", "name", "description", "metadata"],
              filters: { id: brandIdsInProducts[0] as string },
            })
            if (brands?.[0]) brandDetail = brands[0]
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.warn("Brand bilgileri getirilemedi:", error)
    }
  }

  // Metadata ve search filtrelerini uygula
  let filteredProducts = productsWithBrand
  filteredProducts = filterProductsByMetadata(filteredProducts, metadataFilters)
  if (search) {
    filteredProducts = searchInMetadata(filteredProducts, search)
  }

  // Filterable options
  let filterableOptions: {
    categories: Array<{ id: string; name: string; handle: string; count: number }>
    metadata: Record<string, Array<{ value: unknown; count: number }>>
  } = { categories: [], metadata: {} }

  if (includeFilters) {
    // Category options
    if (allCategories.length > 0) {
      filterableOptions.categories = buildCategoryOptions(filteredProducts, allCategories)
    } else if (categoryIdsArg.length === 0) {
      filterableOptions.categories = await buildAutoCategoryOptions(query, filteredProducts)
    }

    // Metadata options — kategori metadata'sını kontrol et
    if (!allowedFilterKeys && parentCategories.length > 0) {
      let categoryMetadata: Record<string, unknown> = {}
      for (const cat of parentCategories) {
        if (cat.metadata) {
          categoryMetadata = { ...categoryMetadata, ...(cat.metadata as Record<string, unknown>) }
        }
      }
      if (Array.isArray((categoryMetadata as Record<string, unknown>).filter_keys)) {
        const filterKeys = (categoryMetadata as Record<string, unknown>).filter_keys as string[]
        if (filterKeys.length > 0) {
          allowedFilterKeys = filterKeys
        }
      }
    }

    filterableOptions.metadata = buildMetadataOptions(productsWithBrand, filteredProducts, allowedFilterKeys)
  }

  // Pagination
  const paginatedProducts = filteredProducts.slice(offset, offset + limit)
  const finalCount = filteredProducts.length

  res.json({
    products: paginatedProducts,
    count: finalCount,
    limit,
    offset,
    filterable_options: filterableOptions,
    ...(brandDetail ? { brand: brandDetail } : {}),
  })
}

/**
 * metadata.brand path handler (extract edildi — tekrarlanan kodu azaltır)
 */
async function handleMetadataBrandPath(
  res: MedusaResponse,
  query: { graph: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productService: any,
  metadataBrandFilterVal: string,
  metadataFilters: Record<string, unknown>,
  search: string,
  limit: number,
  offset: number,
  includeFilters: boolean,
  allowedFilterKeys: string[] | null,
  categoryIdsArg: string[]
) {
  try {
    const MAX_PRODUCTS = 1000
    const [products] = await productService.listAndCountProducts(
      {},
      {
        skip: 0,
        take: MAX_PRODUCTS,
        relations: ["variants", "images", "categories"],
        select: ["id", "title", "handle", "status", "thumbnail", "metadata", "created_at", "updated_at"],
      }
    )

    let withBrandMeta = (products as Record<string, unknown>[]).filter((p: Record<string, unknown>) => {
      const brandVal = (p.metadata as Record<string, unknown>)?.brand
      if (brandVal === undefined || brandVal === null) return false
      return String(brandVal) === String(metadataBrandFilterVal)
    })

    // Brand detayını çek
    let brandDetail: Record<string, unknown> | null = null
    if (withBrandMeta.length > 0) {
      try {
        const { data: brands } = await query.graph({
          entity: "brand",
          fields: ["id", "name", "description", "metadata"],
          filters: { id: metadataBrandFilterVal },
        })
        if (brands?.[0]) brandDetail = brands[0]
      } catch { /* ignore */ }
    }

    // Brand enrich
    if (brandDetail) {
      withBrandMeta = withBrandMeta.map((p: Record<string, unknown>) => ({
        ...p,
        brand: (p.metadata as Record<string, unknown>)?.brand === (brandDetail as Record<string, unknown>).id ? brandDetail : null,
      }))
    }

    // Metadata ve search filter uygula (brand hariç)
    let filteredProducts = withBrandMeta
    const filtersExceptBrand = { ...metadataFilters }
    delete filtersExceptBrand["brand"]
    if (Object.keys(filtersExceptBrand).length) {
      filteredProducts = filterProductsByMetadata(filteredProducts, filtersExceptBrand)
    }
    if (search) {
      filteredProducts = searchInMetadata(filteredProducts, search)
    }

    // Filter options
    let filterableOptions: {
      categories: Array<{ id: string; name: string; handle: string; count: number }>
      metadata: Record<string, Array<{ value: unknown; count: number }>>
    } = { categories: [], metadata: {} }

    if (includeFilters) {
      if (categoryIdsArg.length === 0) {
        filterableOptions.categories = await buildAutoCategoryOptions(query, filteredProducts)
      }
      filterableOptions.metadata = buildMetadataOptions(withBrandMeta, filteredProducts, allowedFilterKeys)
    }

    const paginatedProducts = filteredProducts.slice(offset, offset + limit)

    return res.json({
      products: paginatedProducts,
      count: filteredProducts.length,
      limit,
      offset,
      filterable_options: filterableOptions,
      ...(brandDetail ? { brand: brandDetail } : {}),
    })
  } catch {
    return res.json({
      products: [],
      count: 0,
      limit,
      offset,
      filterable_options: { categories: [], metadata: {} },
    })
  }
}

/**
 * No-filter path handler (extract edildi — tekrarlanan kodu azaltır)
 */
async function handleNoFilterPath(
  res: MedusaResponse,
  query: { graph: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productService: any,
  metadataFilters: Record<string, unknown>,
  search: string,
  limit: number,
  offset: number,
  includeFilters: boolean,
  allowedFilterKeys: string[] | null
) {
  const MAX_PRODUCTS = 1000
  const [products] = await productService.listAndCountProducts(
    {},
    {
      skip: 0,
      take: MAX_PRODUCTS,
      relations: ["variants", "images", "categories"],
      select: ["id", "title", "handle", "status", "thumbnail", "metadata", "created_at", "updated_at"],
    }
  )

  let filteredProducts = products as Record<string, unknown>[]
  if (Object.keys(metadataFilters).length) {
    filteredProducts = filterProductsByMetadata(filteredProducts, metadataFilters)
  }
  if (search) {
    filteredProducts = searchInMetadata(filteredProducts, search)
  }

  // Brand enrich
  let outputBrandDetail: Record<string, unknown> | null = null
  const distinctBrandIds = Array.from(
    new Set(filteredProducts.map((p: Record<string, unknown>) => (p.metadata as Record<string, unknown>)?.brand).filter(Boolean))
  )
  if (distinctBrandIds.length === 1) {
    try {
      const { data: brands } = await query.graph({
        entity: "brand",
        fields: ["id", "name", "description", "metadata"],
        filters: { id: distinctBrandIds[0] },
      })
      if (brands?.[0]) outputBrandDetail = brands[0]
    } catch { /* ignore */ }
  }

  let productsWithBrand = filteredProducts
  if (outputBrandDetail) {
    productsWithBrand = productsWithBrand.map((p: Record<string, unknown>) => ({
      ...p,
      brand: (p.metadata as Record<string, unknown>)?.brand === (outputBrandDetail as Record<string, unknown>).id ? outputBrandDetail : null,
    }))
  }

  // Filter options
  let filterableOptions: {
    categories: Array<{ id: string; name: string; handle: string; count: number }>
    metadata: Record<string, Array<{ value: unknown; count: number }>>
  } = { categories: [], metadata: {} }

  if (includeFilters) {
    filterableOptions.categories = await buildAutoCategoryOptions(query, productsWithBrand)
    filterableOptions.metadata = buildMetadataOptions(productsWithBrand, productsWithBrand, allowedFilterKeys)
  }

  const paginatedProducts = productsWithBrand.slice(offset, offset + limit)

  return res.json({
    products: paginatedProducts,
    count: productsWithBrand.length,
    limit,
    offset,
    filterable_options: filterableOptions,
    ...(outputBrandDetail ? { brand: outputBrandDetail } : {}),
  })
}
