import { Module } from "@medusajs/framework/utils"
import BrandModuleService from "./service"

export const BRAND_MODULE = "brand"


const BrandModule = Module(BRAND_MODULE, {
  service: BrandModuleService,
})

export default BrandModule