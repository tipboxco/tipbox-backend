import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  createBrandCategoryWorkflow,
} from "../../../workflows/create-brand-category"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"

type PostAdminCreateBrandCategoryType = {
  title: string
  thumbnail?: string | null
}

// GET /admin/brand-categories - Brand kategorilerini listele (DB-level pagination, search)
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)

  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const search = (req.query.q as string) || ""

  // DB seviyesinde filtre
  const filters: Record<string, unknown> = {}
  if (search) {
    filters.title = { $like: `%${search}%` }
  }

  // DB seviyesinde pagination ve filtreleme
  const [brandCategories, totalCount] = await brandModuleService.listAndCountBrandCategories(
    filters,
    {
      skip: offset,
      take: limit,
      order: { title: "ASC" },
      select: ["id", "title", "thumbnail", "created_at", "updated_at"],
    }
  )

  const formattedCategories = brandCategories.map((cat: Record<string, unknown>) => ({
    id: cat.id,
    title: cat.title,
    thumbnail: cat.thumbnail || null,
    created_at: cat.created_at instanceof Date ? cat.created_at.toISOString() : cat.created_at,
    updated_at: cat.updated_at instanceof Date ? cat.updated_at.toISOString() : cat.updated_at,
  }))

  res.json({
    brand_categories: formattedCategories,
    count: totalCount,
    limit,
    offset,
  })
}

// POST /admin/brand-categories - Yeni brand category oluştur
export const POST = async (
  req: MedusaRequest<PostAdminCreateBrandCategoryType>,
  res: MedusaResponse
) => {
  const { result } = await createBrandCategoryWorkflow(req.scope)
    .run({
      input: req.body as PostAdminCreateBrandCategoryType,
    })

  res.json({ brand_category: result })
}
