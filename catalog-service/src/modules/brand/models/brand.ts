import { model } from "@medusajs/framework/utils"
import BrandCategory from "./brand-category"
export const Brand = model.define("brand", {
  id: model.id().primaryKey(),
  name: model.text(),
  handle:model.text().nullable(),
  website_url:model.text().nullable(),
  logo_url: model.text().nullable(),
  metadata:model.json().nullable(),
  rank:model.number().nullable(),
  ispopular:model.boolean().nullable(),
  tags:model.json().nullable(),
  banner_url:model.text().nullable(),
  category: model
  .belongsTo(() => BrandCategory, {
    mappedBy: "brands",
  })
  .nullable(), // category_id NULL olabilir
})