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
  logo_url?: string | null
  category_id?: string | null
}

type BrandWithCount = {
  id: string
  name: string
  product_count: number
  created_at?: string
  updated_at?: string
}

type BrandBase = {
  id: string
  name: string
  logo_url?: string | null
  category_id?: string | null
  category?: {
    id: string
    title: string
  } | null
  created_at?: string
  updated_at?: string
}

// GET /admin/brands - Brandleri listele (pagination, search, ürün sayısı desteği)
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
  
  // Tüm brandleri getir (pagination için)
  const brandsFromService = await brandModuleService.listBrands()
  
  // Brand'leri category bilgisi ile birlikte getir
  const allBrandsWithCategory = await Promise.all(
    brandsFromService.map(async (brand: any) => {
      let category = null
      if (brand.category_id) {
        try {
          const { data: categoryData } = await query.graph({
            entity: "brand_category",
            fields: ["id", "title"],
            filters: {
              id: brand.category_id,
            },
          })
          if (categoryData[0]) {
            category = {
              id: categoryData[0].id,
              title: categoryData[0].title,
            }
          }
        } catch {
          // Category bulunamazsa null
        }
      }
      
      return {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url || null,
        category_id: brand.category_id || null,
        category,
        created_at: brand.created_at?.toISOString(),
        updated_at: brand.updated_at?.toISOString(),
      }
    })
  )
  
  let allBrands: BrandBase[] = allBrandsWithCategory
  
  // Search filtresi uygula
  if (search) {
    const searchLower = search.toLowerCase()
    allBrands = allBrands.filter((brand: BrandBase) => 
      brand.name.toLowerCase().includes(searchLower)
    )
  }
  
  const totalCount = allBrands.length
  
  // Pagination uygula
  const paginatedBrands = allBrands.slice(offset, offset + limit)
  
  // Product count isteniyorsa ekle
  let brandsResult: (BrandBase | BrandWithCount)[]
  
  if (includeProductCount) {
    brandsResult = await Promise.all(
      paginatedBrands.map(async (brand: BrandBase) => {
        try {
          const { data: brandData } = await query.graph({
            entity: "brand",
            fields: ["id", "product.id"],
            filters: {
              id: brand.id,
            },
          })
          
          const brandWithProducts = brandData[0]
          let productCount = 0
          
          if (brandWithProducts?.product) {
            if (Array.isArray(brandWithProducts.product)) {
              productCount = brandWithProducts.product.length
            } else if (brandWithProducts.product) {
              productCount = 1
            }
          }
          
          return {
            ...brand,
            product_count: productCount,
          }
        } catch {
          return {
            ...brand,
            product_count: 0,
          }
        }
      })
    )
  } else {
    brandsResult = paginatedBrands
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