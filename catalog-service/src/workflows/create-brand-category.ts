import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../modules/brand"
import BrandModuleService from "../modules/brand/service"

export type CreateBrandCategoryInput = {
  title: string
  thumbnail?: string | null
}

export const createBrandCategoryStep = createStep(
  "create-brand-category-step",
  async (input: CreateBrandCategoryInput, { container }) => {
    const brandModuleService: BrandModuleService = container.resolve(
      BRAND_MODULE
    )

    const brandCategory = await brandModuleService.createBrandCategories(input)

    return new StepResponse(brandCategory, brandCategory.id)
  },
  async (brandCategoryId, { container }) => {
    // Rollback: oluşturulan brand category'yi sil
    const brandModuleService: BrandModuleService = container.resolve(
      BRAND_MODULE
    )
    
    await brandModuleService.deleteBrandCategories(brandCategoryId as string)
  }
)

export const createBrandCategoryWorkflow = createWorkflow(
  "create-brand-category-workflow",
  (input: CreateBrandCategoryInput) => {
    const brandCategory = createBrandCategoryStep(input)
    
    return new WorkflowResponse(brandCategory)
  }
)

