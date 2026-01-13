import { model } from "@medusajs/framework/utils"
import BrandCategory from "./brand-category"
export const Brand = model.define("brand", {
  id: model.id().primaryKey(),
  name: model.text(),
  logo_url: model.text().nullable(),
  metadata:model.json().nullable(),
  category: model
  .belongsTo(() => BrandCategory, {
    mappedBy: "brands",
  })
  .nullable(), // category_id NULL olabilir
})