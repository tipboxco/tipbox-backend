import { MinioStorageService } from "../plugins/minio-storage/service"

/**
 * Brand logo cache orchestrator.
 *
 * Flow ("talep edildiğinde"):
 *   1. MinIO'da deterministik key kontrol edilir (brand-logos/{id}.png).
 *   2. Varsa MinIO public URL döner (kısa devre).
 *   3. Yoksa logo.dev'den çekilir, MinIO'ya kaydedilir, URL döner.
 *
 * Token (LOGO_DEV_API_TOKEN) yalnızca server tarafında kullanılır;
 * client'a sadece MinIO URL'i iletilir.
 */

export type BrandForLogo = {
  id: string
  name?: string | null
  website_url?: string | null
  handle?: string | null
  logo_url?: string | null
}

export type LogoResolveResult = {
  logoUrl: string | null
  // minio-cache: zaten MinIO'da vardı | fetched: logo.dev'den yeni çekildi | none: kaynak yok/başarısız
  source: "minio-cache" | "fetched" | "none"
}

let minioService: MinioStorageService | null = null

function getMinioService(): MinioStorageService {
  if (!minioService) {
    // medusa-config.ts ve admin/media route ile aynı env defaultları
    minioService = new MinioStorageService({
      endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
      bucket: process.env.S3_BUCKET_NAME || "tipbox-medusa",
      accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin123",
      useSSL: process.env.MINIO_USE_SSL === "true",
      region: process.env.S3_REGION || "eu-central-1",
      externalEndpoint: process.env.S3_ENDPOINT_EXTERNAL,
    })
  }
  return minioService
}

function logoCacheKey(brandId: string): string {
  return `brand-logos/${brandId}.png`
}

/**
 * logo.dev sorgu URL'i. Seed ile uyumlu: /name/{website} endpoint'i.
 * website_url yoksa brand adına düşer.
 */
function buildLogoDevUrl(brand: BrandForLogo): string | null {
  const query = (brand.website_url || brand.name || "").trim()
  if (!query) return null

  const token = process.env.LOGO_DEV_API_TOKEN
  const base = `https://img.logo.dev/name/${encodeURIComponent(query)}`
  return token ? `${base}?token=${token}` : base
}

/**
 * Brand logosunu çözer: MinIO cache → yoksa logo.dev'den çek + cache'le.
 * DB güncellemesi caller'ın (route) sorumluluğundadır.
 */
export async function resolveBrandLogo(
  brand: BrandForLogo
): Promise<LogoResolveResult> {
  const minio = getMinioService()
  const key = logoCacheKey(brand.id)

  // 1) MinIO'da zaten var mı?
  try {
    if (await minio.fileExists(key)) {
      return { logoUrl: minio.publicUrl(key), source: "minio-cache" }
    }
  } catch (err) {
    console.error(`[brand-logo] MinIO existence kontrol hatası (${brand.id}):`, err)
    // existence kontrolü patlarsa fetch'e devam etmek yerine durmayalım;
    // yine de logo.dev'den çekmeyi deneriz.
  }

  // 2) logo.dev'den çek
  const sourceUrl = buildLogoDevUrl(brand)
  if (!sourceUrl) {
    return { logoUrl: null, source: "none" }
  }

  try {
    const resp = await fetch(sourceUrl)
    const contentType = resp.headers.get("content-type") || ""
    if (!resp.ok || !contentType.startsWith("image/")) {
      console.warn(
        `[brand-logo] logo.dev başarısız (${brand.id}): status=${resp.status} type=${contentType}`
      )
      return { logoUrl: null, source: "none" }
    }

    const buffer = Buffer.from(await resp.arrayBuffer())

    // 3) MinIO'ya sabit key ile kaydet
    const { url } = await minio.uploadFileWithKey(buffer, key, contentType)
    return { logoUrl: url, source: "fetched" }
  } catch (err) {
    console.error(`[brand-logo] logo çekme/kayıt hatası (${brand.id}):`, err)
    return { logoUrl: null, source: "none" }
  }
}
