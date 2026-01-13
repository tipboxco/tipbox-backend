import { MedusaService } from "@medusajs/framework/utils"
import { Brand } from "./models/brand"
import BrandCategory from "./models/brand-category"

class BrandModuleService extends MedusaService({
  Brand,
  BrandCategory
}) {

}

export default BrandModuleService