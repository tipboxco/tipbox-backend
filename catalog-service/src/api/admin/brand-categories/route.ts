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

type BrandCategoryBase = {
  id: string
  title: string
  thumbnail?: string | null
  created_at?: string
  updated_at?: string
}

// GET /admin/brand-categories - Brand kategorilerini listele
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  
  // Query parametreleri
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const search = (req.query.q as string) || ""

  // Tüm brand kategorilerini getir
  const brandCategoriesFromService = await brandModuleService.listBrandCategories()
  // Date'leri string'e çevir
  let allBrandCategories: BrandCategoryBase[] = brandCategoriesFromService.map((brandCategory: any) => ({
    id: brandCategory.id,
    title: brandCategory.title,
    thumbnail: brandCategory.thumbnail || null,
    created_at: brandCategory.created_at?.toISOString(),
    updated_at: brandCategory.updated_at?.toISOString(),
  }))

  // Search filtresi uygula
  if (search) {
    const searchLower = search.toLowerCase()
    allBrandCategories = allBrandCategories.filter((brandCategory: BrandCategoryBase) => 
      brandCategory.title.toLowerCase().includes(searchLower)
    )
  }

  const totalCount = allBrandCategories.length

  // Pagination uygula
  const paginatedBrandCategories = allBrandCategories.slice(offset, offset + limit)

  res.json({
    brand_categories: paginatedBrandCategories,
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
