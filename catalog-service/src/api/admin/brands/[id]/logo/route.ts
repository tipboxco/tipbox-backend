import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { BRAND_MODULE } from "../../../../../modules/brand"
import BrandModuleService from "../../../../../modules/brand/service"
import { resolveBrandLogo } from "../../../../../lib/brand-logo-service"

// GET /admin/brands/:id/logo
// Marka logosunu MinIO'dan döner; yoksa logo.dev'den çekip MinIO'ya kaydeder
// ve çözülen MinIO URL'ini brand.logo_url'e kalıcı olarak yazar.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const brandModuleService: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const { id } = req.params

  let brand
  try {
    brand = await brandModuleService.retrieveBrand(id)
  } catch {
    return res.status(404).json({ error: "Marka bulunamadı" })
  }

  const { logoUrl, source } = await resolveBrandLogo({
    id: brand.id,
    name: brand.name,
    website_url: brand.website_url,
    handle: brand.handle,
    logo_url: brand.logo_url,
  })

  if (!logoUrl) {
    return res.status(404).json({
      error: "Logo bulunamadı",
      logo_url: null,
      source,
    })
  }

  // Çözülen MinIO URL'ini DB'ye kalıcı yaz (yeni çekildiyse veya logo_url farklıysa).
  if (logoUrl !== brand.logo_url) {
    try {
      await brandModuleService.updateBrands({ id: brand.id, logo_url: logoUrl })
    } catch (err) {
      console.error(`[brand-logo] logo_url DB güncelleme hatası (${brand.id}):`, err)
      // Yazma başarısız olsa bile çözülen URL'i döndürmeye devam et.
    }
  }

  res.json({ logo_url: logoUrl, source })
}
