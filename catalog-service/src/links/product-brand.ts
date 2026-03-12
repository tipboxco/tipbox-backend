import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import BrandModule from "../modules/brand"

export default defineLink(
  {
    linkable: ProductModule.linkable.product,
    isList: true, // Bir brand birden fazla ürüne sahip olabilir → brand.products (list)
  },
  {
    linkable: BrandModule.linkable.brand,
    isList: false, // Her ürün yalnızca bir brand ile ilişkilendirilebilir → product.brand (singular)
  }
)

