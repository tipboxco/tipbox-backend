// src/modules/brand/models/brand-category.ts
import { model } from "@medusajs/framework/utils"
import { Brand } from "./brand"

export const BrandCategory = model.define("brand_category", {
  id: model.id().primaryKey(),
  title: model.text(),
  thumbnail: model.text().nullable(),
  // Bir kategori birden fazla brand'e sahip
  brands: model.hasMany(() => Brand, {
    mappedBy: "category",
    nullable: true,
  }),
  metadata: model.json().nullable(),
})

export default BrandCategory