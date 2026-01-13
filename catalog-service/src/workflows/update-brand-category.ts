import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../modules/brand"
import BrandModuleService from "../modules/brand/service"

export type UpdateBrandCategoryInput = {
  id: string
  title?: string
  thumbnail?: string | null
}

export const updateBrandCategoryStep = createStep(
  "update-brand-category-step",
  async (input: UpdateBrandCategoryInput, { container }) => {
    const brandModuleService: BrandModuleService = container.resolve(
      BRAND_MODULE
    )

    const { id, ...updateData } = input
    const brandCategory = await brandModuleService.updateBrandCategories({ ...updateData, id })

    return new StepResponse(brandCategory)
  }
)

export const updateBrandCategoryWorkflow = createWorkflow(
  "update-brand-category-workflow",
  (input: UpdateBrandCategoryInput) => {
    const brandCategory = updateBrandCategoryStep(input)
    
    return new WorkflowResponse(brandCategory)
  }
)

