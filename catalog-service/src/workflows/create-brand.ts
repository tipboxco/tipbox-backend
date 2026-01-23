import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../modules/brand"
import BrandModuleService from "../modules/brand/service"
import { IEventBusModuleService } from "@medusajs/framework/types"

export type CreateBrandInput = {
  name: string
  handle?: string | null
  website_url?: string | null
  logo_url?: string | null
  banner_url?: string | null
  metadata?: any | null
  rank?: number | null
  ispopular?: boolean | null
  tags?: any | null
  category_id?: string | null
}

export const createBrandStep = createStep(
  "create-brand-step",
  async (input: CreateBrandInput, { container }) => {
    const brandModuleService: BrandModuleService = container.resolve(
      BRAND_MODULE
    )

    const brand = await brandModuleService.createBrands(input)

    return new StepResponse(brand, brand.id)
  },
  async (brandId, { container }) => {
    // Rollback: oluşturulan brand'i sil
    const brandModuleService: BrandModuleService = container.resolve(
      BRAND_MODULE
    )
    
    await brandModuleService.deleteBrands(brandId as string)
  }
)

// Event emit step - Tüm brand verisini gönder
export const emitBrandCreatedStep = createStep(
  "emit-brand-created-step",
  async (brand: { id: string; name: string; logo_url?: string | null; created_at?: Date; updated_at?: Date }, { container }) => {
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
    const brandModuleService: BrandModuleService = container.resolve(BRAND_MODULE)
    
    // Tam brand verisini getir
    const fullBrand = await brandModuleService.retrieveBrand(brand.id)
    
    await eventBus.emit({
      name: "brand.created",
      data: {
        id: fullBrand.id,
        name: fullBrand.name,
        logo_url: fullBrand.logo_url || null,
        created_at: fullBrand.created_at,
        updated_at: fullBrand.updated_at,
      },
    })

    return new StepResponse(undefined)
  }
)

export const createBrandWorkflow = createWorkflow(
  "create-brand-workflow",
  (input: CreateBrandInput) => {
    const brand = createBrandStep(input)
    
    emitBrandCreatedStep(brand)
    
    return new WorkflowResponse(brand)
  }
)