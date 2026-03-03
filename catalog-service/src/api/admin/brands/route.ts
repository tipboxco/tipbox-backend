import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  createBrandWorkflow,
} from "../../../workflows/create-brand"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type PostAdminCreateBrandType = {
  name: string
  handle?: string | null
  website_url?: string | null
  logo_url?: string | null
  banner_url?: string | null
  metadata?: Record<string, unknown> | null
  rank?: number | null
  ispopular?: boolean | null
  tags?: Record<string, unknown> | null
  category_id?: string | null
}

// GET /admin/brands - Brandleri listele (DB-level pagination, search, sort)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Query parametreleri
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const search = (req.query.q as string) || ""
  const includeProductCount = req.query.include_product_count !== "false"

  // DB seviyesinde filtre oluştur
  const filters: Record<string, unknown> = {}
  if (search) {
    filters.name = { $like: `%${search}%` }
  }

  // DB seviyesinde pagination, sort ve filtreleme
  const [brands, totalCount] = await brandModuleService.listAndCountBrands(
    filters,
    {
      skip: offset,
      take: limit,
      order: { name: "ASC" },
      relations: ["category"],
      select: ["id", "name", "logo_url", "category_id", "created_at", "updated_at"],
    }
  )

  const toISOStringSafe = (value: unknown): string | undefined => {
    if (!value) return undefined
    if (value instanceof Date) return value.toISOString()
    if (typeof value === "string") return value
    if (
      typeof value === "object" &&
      value !== null &&
      "toISOString" in value &&
      typeof (value as { toISOString: () => string }).toISOString === "function"
    ) {
      return (value as { toISOString: () => string }).toISOString()
    }
    return undefined
  }

  type BrandResult = {
    id: string
    name: string
    logo_url: string | null
    category_id: string | null
    category: { id: string; title: string } | null
    created_at?: string
    updated_at?: string
    product_count?: number
  }

  const brandRecord = (brand: Record<string, unknown>) => {
    const category = brand.category as Record<string, unknown> | null | undefined
    return {
      id: brand.id as string,
      name: brand.name as string,
      logo_url: (brand.logo_url as string) || null,
      category_id: category?.id as string || (brand.category_id as string) || null,
      category: category
        ? { id: category.id as string, title: category.title as string }
        : null,
      created_at: toISOStringSafe(brand.created_at),
      updated_at: toISOStringSafe(brand.updated_at),
    }
  }

  let brandsResult: BrandResult[] = brands.map(brandRecord)

  // Product count: tek batch sorgusu ile tüm sayfa brand'lerinin ürün sayılarını al
  if (includeProductCount && brandsResult.length > 0) {
    const brandIds = brandsResult.map(b => b.id)

    try {
      const { data: brandsWithProducts } = await query.graph({
        entity: "brand",
        fields: ["id", "product.id"],
        filters: { id: brandIds },
      })

      // Brand ID → product count map oluştur
      const productCountMap = new Map<string, number>()
      for (const brandData of brandsWithProducts) {
        let count = 0
        if (brandData.product) {
          count = Array.isArray(brandData.product) ? brandData.product.length : 1
        }
        productCountMap.set(brandData.id, count)
      }

      brandsResult = brandsResult.map(brand => ({
        ...brand,
        product_count: productCountMap.get(brand.id) || 0,
      }))
    } catch {
      // Product count alınamazsa 0 olarak devam et
      brandsResult = brandsResult.map(brand => ({
        ...brand,
        product_count: 0,
      }))
    }
  }

  res.json({
    brands: brandsResult,
    count: totalCount,
    limit,
    offset,
  })
}

// POST /admin/brands - Yeni brand oluştur
export const POST = async (
  req: MedusaRequest<PostAdminCreateBrandType>,
  res: MedusaResponse
) => {
  const { result } = await createBrandWorkflow(req.scope)
    .run({
      input: req.body as PostAdminCreateBrandType,
    })

  res.json({ brand: result })
}
