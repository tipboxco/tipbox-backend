/**
 * Marka logolarını img.logo.dev API'sinden çekerek Brand tablosundaki logoUrl alanını günceller
 * 
 * Kullanım:
 *   npx ts-node scripts/update-brand-logos.ts
 *   veya
 *   docker-compose exec backend npx ts-node scripts/update-brand-logos.ts
 */

import { PrismaClient } from '@prisma/client'
import { brandToWebsite } from '../src/data/brandToWebsite'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const slugify = require('slugify')

const prisma = new PrismaClient()

const slugifyOptions = {
  lower: true,
  strict: true,
  locale: 'tr',
  trim: true,
}

async function updateBrandLogosFromLogoDev(): Promise<void> {
  console.log('\n🖼️  Marka logoları güncelleniyor (img.logo.dev)...\n')
  
  // brandToWebsite mapping'ini oluştur
  const brandMap: { [key: string]: { brand: string; website: string } } = {}
  brandToWebsite.forEach((brand) => {
    const slug = slugify(brand.brand, slugifyOptions)
    // Aynı slug için ilk eşleşmeyi kullan (daha sonraki eşleşmeleri override etme)
    if (!brandMap[slug]) {
      brandMap[slug] = brand
    }
  })
  
  // Tüm brand'leri çek
  const allBrands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true,
      imageUrl: true,
    },
  })
  
  console.log(`📊 Toplam ${allBrands.length} marka bulundu\n`)
  
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  for (const brand of allBrands) {
    try {
      // Eğer logoUrl zaten varsa ve boş değilse, atla
      if (brand.logoUrl && brand.logoUrl.length > 0 && brand.logoUrl !== 'NULL') {
        skippedCount++
        continue
      }
      
      // Brand adını slugify et
      const slugBrand = slugify(brand.name, slugifyOptions)
      
      // brandToWebsite mapping'inden website'i bul
      const brandData = brandMap[slugBrand]
      const website = brandData?.website
      
      // Logo URL'ini belirle (brand.service.ts mantığına göre)
      // brand.service.ts'de: imageUrl varsa resolveMediaUrl kullanılır, yoksa website varsa img.logo.dev kullanılır
      // Biz logoUrl'e yazıyoruz, o yüzden website varsa img.logo.dev'den çekiyoruz
      let logoUrl: string | null = null
      
      if (website) {
        // website varsa, img.logo.dev API'sinden logo çek
        logoUrl = `https://img.logo.dev/name/${website}?token=${process.env.LOGO_DEV_API_TOKEN}`
      }
      
      // Eğer logoUrl bulunduysa, güncelle
      if (logoUrl) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { logoUrl },
        })
        updatedCount++
        
        console.log(`   ✅ ${brand.name} -> ${logoUrl}`)
        
        // Her 10 brand'ta bir progress göster
        if (updatedCount % 10 === 0) {
          console.log(`\n   📊 İlerleme: ${updatedCount} güncellendi, ${skippedCount} atlandı, ${errorCount} hata\n`)
        }
      } else {
        skippedCount++
        console.log(`   ⏭️  ${brand.name} -> Website bulunamadı`)
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`   ❌ ${brand.name} için logo güncellenemedi: ${errorMsg}`)
      errorCount++
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅ Marka logoları güncelleme tamamlandı:`)
  console.log(`   📝 Güncellenen: ${updatedCount}`)
  console.log(`   ⏭️  Atlanan: ${skippedCount}`)
  if (errorCount > 0) {
    console.log(`   ❌ Hatalar: ${errorCount}`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}

async function main() {
  try {
    await updateBrandLogosFromLogoDev()
  } catch (error) {
    console.error('❌ Hata:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
