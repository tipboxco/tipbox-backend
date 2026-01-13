import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Helper: Parse query param arrays (e.g., filters[0], filters[1] -> filters: [..])
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

async function getAllChildCategoryIds(
  query: any,
  parentCategoryId: string
): Promise<string[]> {
  const allCategoryIds: string[] = [parentCategoryId]
  const visited = new Set<string>([parentCategoryId])
  const toProcess: string[] = [parentCategoryId]
  try {
    const { data: allCategories } = await query.graph({
      entity: "product_category",
      fields: ["id", "parent_category.id"],
      filters: {},
    })
    const parentChildMap = new Map<string, string[]>()
    for (const cat of allCategories || []) {
      if (cat.parent_category?.id) {
        const parentId = cat.parent_category.id
        if (!parentChildMap.has(parentId)) parentChildMap.set(parentId, [])
        parentChildMap.get(parentId)!.push(cat.id)
      }
    }
    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!
      const children = parentChildMap.get(currentId) || []
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId)
          allCategoryIds.push(childId)
          toProcess.push(childId)
        }
      }
    }
  } catch (error) {
    console.warn("Alt kategori bulunamadı:", error)
  }
  return allCategoryIds
}

async function getCategoryWithMetadata(
  query: any,
  categoryId: string
): Promise<any> {
  try {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle", "metadata", "parent_category.*"],
      filters: {
        id: categoryId,
      },
    })
    return categories?.[0] || null
  } catch (error) {
    console.warn("Kategori bulunamadı:", error)
    return null
  }
}

// Utility: filterProductsByMetadata
function filterProductsByMetadata(products: any[], metadataFilters: Record<string, any>): any[] {
  if (!metadataFilters || Object.keys(metadataFilters).length === 0) return products
  return products.filter(p => {
    const m = p.metadata || {}
    for (const key in metadataFilters) {
      const value = metadataFilters[key]
      if (typeof value === "undefined" || value === null) continue
      const v = m[key]
      if (Array.isArray(value)) {
        if (v === undefined || v === null) return false
        if (Array.isArray(v)) {
          if (!v.some(item => value.includes(item))) return false
        } else {
          if (!value.includes(v)) return false
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

// Utility: searchInMetadata - searches in title and metadata values
function searchInMetadata(products: any[], search: string): any[] {
  if (!search || typeof search !== "string" || !search.trim()) return products
  const q = search.trim().toLowerCase()
  return products.filter(p => {
    if (typeof p.title === "string" && p.title.toLowerCase().includes(q)) return true
    const m = p.metadata || {}
    for (const key in m) {
      const val = m[key]
      if (typeof val === "string" && val.toLowerCase().includes(q)) return true
      if (typeof val === "number" && String(val).includes(q)) return true
      if (Array.isArray(val) && val.some(v => typeof v === 'string' && v.toLowerCase().includes(q))) return true
      if (Array.isArray(val) && val.some(v => typeof v === 'number' && String(v).includes(q))) return true
    }
    return false
  })
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
  const parsedQuery = parseArrayQuery(req.query as Record<string, any>)
  
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
  // categoryIdsArg boş kalabilir.

  const brandId = parsedQuery.brand_id as string | undefined
  const search = (parsedQuery.q as string) || ""
  const limit = parseInt(parsedQuery.limit as string) || 20
  const offset = parseInt(parsedQuery.offset as string) || 0
  const includeFilters = parsedQuery.include_filters !== "false"

  // filter_keys (geliştirici amaçlı/çevresel parametre)
  let allowedFilterKeys: string[] | null = null
  if (parsedQuery.filter_keys) {
    const filterKeysParam = parsedQuery.filter_keys
    if (typeof filterKeysParam === 'string') {
      allowedFilterKeys = filterKeysParam.split(',').map(k => k.trim()).filter(Boolean)
    } else if (Array.isArray(filterKeysParam)) {
      allowedFilterKeys = filterKeysParam.map(k => String(k).trim()).filter(Boolean)
    }
  }
  if (!allowedFilterKeys) {
    // Sadece örnek: env FILTERABLE_METADATA_KEYS (Node ortamında alınabilir)
    const envKeys = process?.env?.FILTERABLE_METADATA_KEYS || ""
    if (envKeys && typeof envKeys === 'string' && envKeys.trim()) {
      allowedFilterKeys = envKeys.split(',').map(k => k.trim()).filter(Boolean)
      if (allowedFilterKeys.length === 0) allowedFilterKeys = null
    }
  }

  let allProductIds: string[] = []
  let topCategoryIds: string[] = []
  let categoryIds: string[] = []
  let parentCategories: any[] = []
  let allCategories: any[] = []
  let brandDetail: any = null // extra output for metadata.brand

  // Category-based filtering
  if (categoryIdsArg.length > 0) {
    parentCategories = []
    for (const singleCatId of categoryIdsArg) {
      const catObj = await getCategoryWithMetadata(query, singleCatId)
      if (!catObj) {
        return res.status(404).json({
          error: `Kategori bulunamadı: ${singleCatId}`,
        })
      }
      parentCategories.push(catObj)
    }
    // alt kategori id'leri çıkar
    let childCategoryIds: string[] = []
    for (const parentCat of categoryIdsArg) {
      const childrenIds = await getAllChildCategoryIds(query, parentCat)
      childCategoryIds.push(...childrenIds)
    }
    categoryIds = Array.from(new Set<string>(childCategoryIds))

    // kategori optionları
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

    // kategori bazlı ürün toplama
    if (categoryIds.length > 0) {
      try {
        const productIdSets: Set<string>[] = []
        for (const catId of categoryIds) {
          try {
            const { data: productsInCategory } = await query.graph({
              entity: "product",
              fields: ["id"],
              filters: {
                categories: {
                  id: catId,
                } as any,
              },
            })
            if (productsInCategory && productsInCategory.length > 0) {
              const ids = productsInCategory.map((p: { id: string }) => p.id)
              productIdSets.push(new Set(ids))
            }
          } catch (err) {
            console.warn(`Kategori ${catId} için ürünler getirilemedi:`, err)
          }
        }
        // hepsini birleştir (union)
        const allIdsSet = new Set<string>()
        for (const idSet of productIdSets) idSet.forEach(id => allIdsSet.add(id))
        allProductIds = Array.from(allIdsSet)
      } catch (error) {
        console.warn("Kategori ürünleri getirilemedi:", error)
      }
    }
  }

  // Brand-based filtering
  // 1) filter üzerinden brand_id sorgusu
  // 2) veya metadata.brand (manuel, backend filter)
  let metadataBrandFilterVal: string | null = null
  // metadata.<key> parser
  const metadataFilters: Record<string, any> = {}
  for (const key in parsedQuery) {
    if (key.startsWith("metadata.")) {
      const metadataKey = key.replace("metadata.", "")
      const value = parsedQuery[key]
      metadataFilters[metadataKey] = Array.isArray(value)
        ? value.filter(Boolean)
        : value
      if (metadataKey === "brand" && typeof value === "string") {
        metadataBrandFilterVal = value
      }
    }
  }

  // Brand-based filtering with brand_id
  if (brandId) {
    try {
      const { data: brands } = await query.graph({
        entity: "brand",
        fields: ["id", "product.id", "name", "description", "metadata"], // detaylar da alınsın
        filters: {
          id: brandId,
        },
      })

      const brand = brands?.[0]
      if (!brand) {
        return res.status(404).json({
          error: "Brand bulunamadı",
        })
      }
      brandDetail = brand // output içine ekleyeceğiz

      const brandProductIds = brand.product
        ? (Array.isArray(brand.product)
            ? brand.product.map((p: any) => p.id)
            : [brand.product.id])
        : []

      // Category de varsa, intersection
      if (categoryIdsArg.length > 0 && allProductIds.length > 0) {
        allProductIds = allProductIds.filter(id =>
          brandProductIds.includes(id)
        )
      } else {
        allProductIds = brandProductIds
      }
    } catch (error) {
      console.warn("Brand ürünleri getirilemedi:", error)
    }
  }

  // Eğer category yok ve brand_id de yok ve metadata.brand varsa, sadece metadata.brand üzerinden process!
  // Bu durumda allProductIds sonucunu tam baştan belirle
  if (categoryIdsArg.length === 0 && !brandId && metadataBrandFilterVal) {
    // Sadece metadata.brand değerine göre etkin filtreleme yapılacak
    // products tablosundan doğrudan çekemiyoruz, meta filter sunucu üstünde
    // Tüm ürünler listelenip meta filter geçilecek. (Burada optimize etmek için limit koy)
    try {
      const [products, totalCount] = await productService.listAndCountProducts(
        {},
        {
          skip: 0,
          take: 5000, // maxProductsForFiltering
          relations: ["variants", "images", "categories"],
          select: [
            "id", "title", "handle", "status", "thumbnail", "metadata",
            "created_at", "updated_at",
          ],
        }
      )
      let withBrandMeta = products.filter((p: any) => {
        const _brandVal = p.metadata?.brand
        if (_brandVal === undefined || _brandVal === null) return false
        if (Array.isArray(metadataBrandFilterVal)) {
          return metadataBrandFilterVal.includes(_brandVal)
        }
        return String(_brandVal) === String(metadataBrandFilterVal)
      }).map((p: any) => ({ ...p }))

      // Brand detayını ekle
      // 1) Find brand by metadataBrandFilterVal
      // 2) Eğer bir brand obje ise tek, array ise ilk (tek ise detay), yoksa null
      if (withBrandMeta.length > 0) {
        try {
          // Tek metadata.brand varsa detayını çek
          const { data: brands } = await query.graph({
            entity: "brand",
            fields: ["id", "name", "description", "metadata"],
            filters: { id: metadataBrandFilterVal },
          })
          if (brands && brands.length === 1) {
            brandDetail = brands[0]
          }
        } catch (err) {
          // Brand detayını alamadıysa, yok say ve devam et
          console.warn("Brand detail fetch for metadata.brand failed", err)
        }
      }

      // Brand enrich, eğer o brand'in detayını ekle
      if (brandDetail && typeof brandDetail === "object") {
        withBrandMeta = withBrandMeta.map((p: any) => ({
          ...p,
          brand: (brandDetail && p.metadata?.brand === brandDetail.id) ? brandDetail : null,
        }))
      }

      // Metadata ve search filter uygula (gelen filter params uygulanmalı)
      let filteredProducts = withBrandMeta
      // Diğer metadata filtreleri (brand hariç) uygula
      const filtersExceptBrand = { ...metadataFilters }
      delete filtersExceptBrand["brand"]
      if (Object.keys(filtersExceptBrand).length) {
        filteredProducts = filterProductsByMetadata(filteredProducts, filtersExceptBrand)
      }
      // Search uygula
      if (search) {
        filteredProducts = searchInMetadata(filteredProducts, search)
      }

      // Filter options çıkar
      let filterableOptions: {
        categories: any[]
        metadata: Record<string, any[]>
      } = {
        categories: [],
        metadata: {},
      }
      if (includeFilters) {
        // otomatik kategori toplama, eğer category id gelmemişse:
        // Her ürünün tüm kategorilerini topla, id uniq yap, ve category bilgisini çek
        if (categoryIdsArg.length === 0) {
          // get all unique category ids from filteredProducts
          const categoryIdSet = new Set<string>()
          for (const p of filteredProducts) {
            if (Array.isArray(p.categories)) {
              for (const cat of p.categories) {
                if (cat && typeof cat.id === "string") {
                  categoryIdSet.add(cat.id)
                }
              }
            }
          }
          if (categoryIdSet.size > 0) {
            try {
              const { data: categories } = await query.graph({
                entity: "product_category",
                fields: ["id", "name", "handle"],
                filters: { id: Array.from(categoryIdSet) },
              })
              // Sayım bul
              const categoryProductCounts = new Map<string, number>()
              for (const product of filteredProducts) {
                if (Array.isArray(product.categories)) {
                  const counted = new Set()
                  for (const cat of product.categories) {
                    if (cat && typeof cat.id === "string" && !counted.has(cat.id)) {
                      categoryProductCounts.set(cat.id, (categoryProductCounts.get(cat.id) || 0) + 1)
                      counted.add(cat.id)
                    }
                  }
                }
              }
              filterableOptions.categories = (categories || []).map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                handle: cat.handle,
                count: categoryProductCounts.get(cat.id) || 0,
              })).filter(cat => cat.count > 0).sort((a, b) => b.count - a.count)
            } catch (err) {
              // ignore error, leave categories empty
            }
          }
        }
        // Metadata field analizini uygula
        // Tüm key ve value'ları bul, filteredProducts'tan count'la
        const metadataKeyValueMap = new Map<string, Set<string | number | boolean>>()
        for (const product of withBrandMeta) {
          const metadata = product.metadata || {}
          for (const key in metadata) {
            if (!key.startsWith('_') && key !== 'filter_keys' && metadata[key] !== undefined && metadata[key] !== null) {
              const value = metadata[key]
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                if (!metadataKeyValueMap.has(key)) metadataKeyValueMap.set(key, new Set())
                metadataKeyValueMap.get(key)!.add(value)
              }
            }
          }
        }
        // countları bul
        const metadataCounts: Record<string, Record<string, number>> = {}
        for (const product of filteredProducts) {
          const metadata = product.metadata || {}
          for (const key of metadataKeyValueMap.keys()) {
            if (metadata[key] !== undefined && metadata[key] !== null) {
              if (!metadataCounts[key]) metadataCounts[key] = {}
              const valueStr = String(metadata[key])
              metadataCounts[key][valueStr] = (metadataCounts[key][valueStr] || 0) + 1
            }
          }
        }
        // filtre key'leri
        let keysToUse: string[] = []
        if (allowedFilterKeys && allowedFilterKeys.length > 0) {
          keysToUse = allowedFilterKeys.filter((k: string) => metadataKeyValueMap.has(k))
        } else {
          keysToUse = Array.from(metadataKeyValueMap.keys())
        }
        filterableOptions.metadata = {}
        for (const key of keysToUse) {
          const valueSet = metadataKeyValueMap.get(key)
          if (!valueSet || valueSet.size === 0) continue
          const values = Array.from(valueSet)
          filterableOptions.metadata[key] = values
            .map(value => ({
              value,
              count: metadataCounts[key]?.[String(value)] || 0,
            }))
            .filter(opt => opt.count > 0)
            .sort((a, b) => {
              if (b.count !== a.count) {
                return b.count - a.count
              }
              return String(a.value).localeCompare(String(b.value))
            })
        }
      }
      const paginatedProducts = filteredProducts.slice(offset, offset + limit)
      const finalCount = filteredProducts.length

      return res.json({
        products: paginatedProducts,
        count: finalCount,
        limit,
        offset,
        filterable_options: filterableOptions,
        ...(brandDetail ? { brand: brandDetail } : {}),
      })
    } catch (error) {
      return res.json({
        products: [],
        count: 0,
        limit,
        offset,
        filterable_options: {
          categories: [],
          metadata: {},
        },
        ...(brandDetail ? { brand: brandDetail } : {}),
      })
    }
  }

  // Eğer category veya brand veya metadata.brand yoksa, başka filtrelere bakılarak devam edilir.
  // Ancak hiçbir ürün id'si çıkmazsa, boş dönülür
  if (categoryIdsArg.length === 0 && !brandId && !metadataBrandFilterVal) {
    // Belki başka filtrelerle arama yapmak mümkün (ör. title, q, diğer metadata.* parametreleri), fallback
    // Tüm ürünlerden filtre uygula: optimize için limitli!
    const [products, totalCount] = await productService.listAndCountProducts(
      {},
      {
        skip: 0,
        take: 5000, // Max ürün
        relations: ["variants", "images", "categories"],
        select: [
          "id",
          "title",
          "handle",
          "status",
          "thumbnail",
          "metadata",
          "created_at",
          "updated_at",
        ],
      }
    )
    let filteredProducts = products
    if (Object.keys(metadataFilters).length) {
      filteredProducts = filterProductsByMetadata(filteredProducts, metadataFilters)
    }
    if (search) {
      filteredProducts = searchInMetadata(filteredProducts, search)
    }
    // Brand enrich (metada.brand extra detay getir), bulk fetch
    let productsWithBrand = filteredProducts
    let outputBrandDetail = null
    const distinctBrandIds = Array.from(new Set(filteredProducts.map((p: any) => p.metadata?.brand).filter(Boolean)))
    if (distinctBrandIds.length === 1) {
      // tek bir marka varsa brand detayını çek
      try {
        const { data: brands } = await query.graph({
          entity: "brand",
          fields: ["id", "name", "description", "metadata"],
          filters: { id: distinctBrandIds[0] },
        })
        if (brands && brands.length === 1) {
          outputBrandDetail = brands[0]
        }
      } catch (e) {}
    }
    // enrich
    if (outputBrandDetail) {
      productsWithBrand = productsWithBrand.map((p: any) => ({
        ...p,
        brand: p.metadata?.brand === outputBrandDetail.id ? outputBrandDetail : null,
      }))
    }

    // filterable options hesapla
    let filterableOptions: {
      categories: any[]
      metadata: Record<string, any[]>
    } = {
      categories: [],
      metadata: {},
    }
    if (includeFilters) {
      // otomatik kategori toplama, eğer category id gelmemişse:
      if (categoryIdsArg.length === 0) {
        // get all unique category ids from productsWithBrand
        const categoryIdSet = new Set<string>()
        for (const p of productsWithBrand) {
          if (Array.isArray(p.categories)) {
            for (const cat of p.categories) {
              if (cat && typeof cat.id === "string") {
                categoryIdSet.add(cat.id)
              }
            }
          }
        }
        if (categoryIdSet.size > 0) {
          try {
            const { data: categories } = await query.graph({
              entity: "product_category",
              fields: ["id", "name", "handle"],
              filters: { id: Array.from(categoryIdSet) },
            })
            // Sayım bul
            const categoryProductCounts = new Map<string, number>()
            for (const product of productsWithBrand) {
              if (Array.isArray(product.categories)) {
                const counted = new Set()
                for (const cat of product.categories) {
                  if (cat && typeof cat.id === "string" && !counted.has(cat.id)) {
                    categoryProductCounts.set(cat.id, (categoryProductCounts.get(cat.id) || 0) + 1)
                    counted.add(cat.id)
                  }
                }
              }
            }
            filterableOptions.categories = (categories || []).map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              handle: cat.handle,
              count: categoryProductCounts.get(cat.id) || 0,
            })).filter(cat => cat.count > 0).sort((a, b) => b.count - a.count)
          } catch (err) {
            // ignore error, leave categories empty
          }
        }
      }
      const metadataKeyValueMap = new Map<string, Set<string | number | boolean>>()
      for (const product of productsWithBrand) {
        const metadata = product.metadata || {}
        for (const key in metadata) {
          if (!key.startsWith('_') && key !== 'filter_keys' && metadata[key] !== undefined && metadata[key] !== null) {
            const value = metadata[key]
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              if (!metadataKeyValueMap.has(key)) metadataKeyValueMap.set(key, new Set())
              metadataKeyValueMap.get(key)!.add(value)
            }
          }
        }
      }
      const metadataCounts: Record<string, Record<string, number>> = {}
      for (const product of productsWithBrand) {
        const metadata = product.metadata || {}
        for (const key of metadataKeyValueMap.keys()) {
          if (metadata[key] !== undefined && metadata[key] !== null) {
            if (!metadataCounts[key]) metadataCounts[key] = {}
            const valueStr = String(metadata[key])
            metadataCounts[key][valueStr] = (metadataCounts[key][valueStr] || 0) + 1
          }
        }
      }
      let keysToUse: string[] = []
      if (allowedFilterKeys && allowedFilterKeys.length > 0) {
        keysToUse = allowedFilterKeys.filter((k: string) => metadataKeyValueMap.has(k))
      } else {
        keysToUse = Array.from(metadataKeyValueMap.keys())
      }
      filterableOptions.metadata = {}
      for (const key of keysToUse) {
        const valueSet = metadataKeyValueMap.get(key)
        if (!valueSet || valueSet.size === 0) continue
        const values = Array.from(valueSet)
        filterableOptions.metadata[key] = values
          .map(value => ({
            value,
            count: metadataCounts[key]?.[String(value)] || 0,
          }))
          .filter(opt => opt.count > 0)
          .sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count
            }
            return String(a.value).localeCompare(String(b.value))
          })
      }
    }

    const paginatedProducts = productsWithBrand.slice(offset, offset + limit)
    const finalCount = productsWithBrand.length

    return res.json({
      products: paginatedProducts,
      count: finalCount,
      limit,
      offset,
      filterable_options: filterableOptions,
      ...(outputBrandDetail ? { brand: outputBrandDetail } : {}),
    })
  }

  // --- Normal branch (hem category hem/veya brand varsa) ---

  // Eğer brand yoksa, ama allProductIds hâlâ boş ise, tekrar products list&filter'dan çek.
  if (allProductIds.length === 0) {
    return res.json({
      products: [],
      count: 0,
      limit,
      offset,
      filterable_options: {
        categories: [],
        metadata: {},
      },
      ...(brandDetail ? { brand: brandDetail } : {}),
    })
  }

  // Ürün detayları -- ana sorgu
  const productFilters: Record<string, any> = {
    id: allProductIds,
  }
  for (const key in parsedQuery) {
    if (
      [
        "category_id",
        "brand_id",
        "q",
        "limit",
        "offset",
        "include_filters",
        "filter_keys",
      ].includes(key) ||
      key.startsWith("metadata.")
    ) {
      continue
    }
    const val = parsedQuery[key]
    if (val !== undefined && val !== null) {
      productFilters[key] = Array.isArray(val) ? val.filter(Boolean) : val
    }
  }

  // max products limit
  const maxProductsForFiltering = 5000
  const shouldLimitProducts = allProductIds.length > maxProductsForFiltering
  const [products, totalCount] = await productService.listAndCountProducts(
    productFilters,
    {
      skip: 0,
      take: shouldLimitProducts ? maxProductsForFiltering : allProductIds.length,
      relations: ["variants", "images", "categories"],
      select: [
        "id",
        "title",
        "handle",
        "status",
        "thumbnail",
        "metadata",
        "created_at",
        "updated_at",
      ],
    }
  )

  // Brand bilgisini query.graph ile ayrı çek (link olduğu için)
  let productsWithBrand = products
  let brandDetailsCache: Record<string, any> = {}
  if (products.length > 0) {
    try {
      const productIds = products.map((p: { id: string }) => p.id)
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
      productsWithBrand = products.map((p: any) => ({
        ...p,
        brand: brandMap.get(p.id) || null,
      }))

      // Eğer sadece tek bir brand (id) varsa ve detay POST ile istenmişse, cache'e al
      const brandIdsInProducts = Array.from(new Set(productsWithBrand.map(p => p.brand?.id).filter(Boolean)))
      if (brandIdsInProducts.length === 1) {
        try {
          const { data: brands } = await query.graph({
            entity: "brand",
            fields: ["id", "name", "description", "metadata"],
            filters: { id: brandIdsInProducts[0] },
          })
          if (brands && brands.length === 1) {
            brandDetail = brands[0]
          }
        } catch (e) {}
      }

    } catch (error) {
      console.warn("Brand bilgileri getirilemedi:", error)
      // Hata olsa bile devam et
    }
  }

  // Metadata ve search filtrelerini uygula
  let filteredProducts = productsWithBrand
  filteredProducts = filterProductsByMetadata(filteredProducts, metadataFilters)
  if (search) {
    filteredProducts = searchInMetadata(filteredProducts, search)
  }

  // Filterable options oluştur
  let filterableOptions: {
    categories: any[]
    metadata: Record<string, any[]>
  } = {
    categories: [],
    metadata: {},
  }

  if (includeFilters) {
    // Category options (alt kategoriler)
    if (allCategories.length > 0) {
      const categoryProductCounts = new Map<string, number>()
      const categoryIdSet = new Set(categoryIds)
      for (const product of filteredProducts) {
        const productCategories = product.categories || []
        const processedCategories = new Set<string>()
        for (const cat of productCategories) {
          if (cat?.id && categoryIdSet.has(cat.id) && !processedCategories.has(cat.id)) {
            categoryProductCounts.set(
              cat.id,
              (categoryProductCounts.get(cat.id) || 0) + 1
            )
            processedCategories.add(cat.id)
          }
        }
      }

      filterableOptions.categories = allCategories
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          handle: cat.handle,
          count: categoryProductCounts.get(cat.id) || 0,
        }))
        .filter((cat) => cat.count > 0)
        .sort((a, b) => b.count - a.count)
    } else if (categoryIdsArg.length === 0) {
      // Otomatik kategori listesi: kategori parametresi yoksa, filtrelenen ürünlerin tüm kategorilerinden yolla
      const categoryIdSet = new Set<string>()
      for (const p of filteredProducts) {
        if (Array.isArray(p.categories)) {
          for (const cat of p.categories) {
            if (cat && typeof cat.id === "string") {
              categoryIdSet.add(cat.id)
            }
          }
        }
      }
      if (categoryIdSet.size > 0) {
        try {
          const { data: categories } = await query.graph({
            entity: "product_category",
            fields: ["id", "name", "handle"],
            filters: { id: Array.from(categoryIdSet) },
          })
          // Sayım bul
          const categoryProductCounts = new Map<string, number>()
          for (const product of filteredProducts) {
            if (Array.isArray(product.categories)) {
              const counted = new Set()
              for (const cat of product.categories) {
                if (cat && typeof cat.id === "string" && !counted.has(cat.id)) {
                  categoryProductCounts.set(cat.id, (categoryProductCounts.get(cat.id) || 0) + 1)
                  counted.add(cat.id)
                }
              }
            }
          }
          filterableOptions.categories = (categories || []).map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            handle: cat.handle,
            count: categoryProductCounts.get(cat.id) || 0,
          })).filter(cat => cat.count > 0).sort((a, b) => b.count - a.count)
        } catch (err) {
          // ignore error, leave categories empty
        }
      }
    }

    // Metadata options - key'ler
    let categoryMetadata = {}
    if (parentCategories && Array.isArray(parentCategories) && parentCategories.length > 0) {
      for (const cat of parentCategories) {
        if (cat && cat.metadata) {
          categoryMetadata = {
            ...categoryMetadata,
            ...cat.metadata,
          }
        }
      }
    }
    const allProductsForMetadataKeys = productsWithBrand
    const metadataKeyValueMap = new Map<string, Set<string | number | boolean>>()
    for (const product of allProductsForMetadataKeys) {
      const metadata = product.metadata || {}
      for (const key in metadata) {
        if (!key.startsWith('_') && key !== 'filter_keys' && metadata[key] !== undefined && metadata[key] !== null) {
          const value = metadata[key]
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            if (!metadataKeyValueMap.has(key)) {
              metadataKeyValueMap.set(key, new Set())
            }
            metadataKeyValueMap.get(key)!.add(value)
          }
        }
      }
    }
    const metadataCounts: Record<string, Record<string, number>> = {}
    for (const product of filteredProducts) {
      const metadata = product.metadata || {}
      for (const key of metadataKeyValueMap.keys()) {
        if (metadata[key] !== undefined && metadata[key] !== null) {
          if (!metadataCounts[key]) {
            metadataCounts[key] = {}
          }
          const valueStr = String(metadata[key])
          metadataCounts[key][valueStr] = (metadataCounts[key][valueStr] || 0) + 1
        }
      }
    }
    let keysToUse: string[] = []
    if (allowedFilterKeys && allowedFilterKeys.length > 0) {
      keysToUse = allowedFilterKeys.filter((k: string) => metadataKeyValueMap.has(k))
    } else {
      let filterKeys: string[] = []
      if (categoryMetadata && Array.isArray((categoryMetadata as any).filter_keys)) {
        filterKeys = (categoryMetadata as any).filter_keys
      }
      keysToUse = filterKeys.length > 0
        ? filterKeys.filter((k: string) => metadataKeyValueMap.has(k))
        : Array.from(metadataKeyValueMap.keys())
    }
    filterableOptions.metadata = {}
    for (const key of keysToUse) {
      const valueSet = metadataKeyValueMap.get(key)
      if (!valueSet || valueSet.size === 0) continue
      const values = Array.from(valueSet)
      filterableOptions.metadata[key] = values
        .map(value => ({
          value,
          count: metadataCounts[key]?.[String(value)] || 0,
        }))
        .filter(opt => opt.count > 0)
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count
          }
          return String(a.value).localeCompare(String(b.value))
        })
    }
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
