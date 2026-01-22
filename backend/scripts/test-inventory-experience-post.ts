/**
 * Inventory Experience Post Test Script
 * 
 * ⚠️  DEPRECATED: Bu script'in mantığı artık seed.ts dosyasına taşınmıştır.
 * 
 * seed.ts içindeki seedUserInventories() fonksiyonu, burakcan@tipbox.co kullanıcısı için
 * otomatik olarak mevcut inventory'sinde olmayan 2 ürün seçip experience post oluşturur.
 * 
 * Bu script artık kullanılmamaktadır. Seed çalıştırıldığında bu işlem otomatik olarak yapılır.
 * 
 * Eğer manuel test yapmak isterseniz, seed.ts dosyasındaki ilgili bölümü inceleyebilirsiniz.
 * 
 * @deprecated Artık seed.ts içinde çalışıyor
 */

import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../src/application/inventory/inventory.service'
import { PostService } from '../src/application/post/post.service'
import { GeminiService } from '../src/infrastructure/ai/gemini.service'
import { ContextType } from '../src/domain/content/context-type.enum'
import { ExperienceStatus } from '../src/domain/content/experience-status.enum'
import { ExperienceType } from '../src/domain/content/experience-type.enum'
import type { Experience } from '../src/interfaces/post/post.dto'

const prisma = new PrismaClient()

// Popüler marka/kategori listeleri (seed'den)
const POPULAR_BRAND_NAMES = [
  'HP',
  'SAMSUNG',
  'Apple',
  'Dell',
  'REVLON',
  'Sony',
  'Lenovo',
  "L'Oreal Paris",
  'NYX PROFESSIONAL MAKEUP',
  'MAYBELLINE',
  'NEEWER',
  'K&F CONCEPT',
  'ASUS',
  'Neutrogena',
  'Bath & Body Works',
]

const POPULAR_CATEGORY_NAMES = [
  'Laptops',
  'Carrier Cell Phones',
  'Desktops',
  'Accessories',
  'Selfie Sticks & Tripods',
  'Accessory Kits',
  'Sets & Kits',
  'Masks',
  'Face Moisturizers',
  'Face Mists',
  'Soaps',
  'Gels',
  'Balms & Moisturizers',
  'Lip Sunscreens',
]

const normalizedPopularBrandNames = new Set(POPULAR_BRAND_NAMES.map(name => name.toLowerCase().trim()))
const normalizedPopularCategoryNames = new Set(POPULAR_CATEGORY_NAMES.map(name => name.toLowerCase().trim()))

function normalizeName(value?: string | null): string {
  return (value || '').toLowerCase().trim()
}

function isPopularIntersectionProduct(product: { brand?: { name?: string | null } | null; category?: { name?: string | null } | null }): boolean {
  const brandName = normalizeName(product.brand?.name)
  const categoryName = normalizeName(product.category?.name)
  return Boolean(brandName && categoryName && normalizedPopularBrandNames.has(brandName) && normalizedPopularCategoryNames.has(categoryName))
}

async function main() {
  console.log('🚀 Inventory Experience Post Test Script Başlatılıyor...\n')

  try {
    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: 'burakcan@tipbox.co' },
    })

    if (!user) {
      console.error('❌ Kullanıcı bulunamadı: burakcan@tipbox.co')
      process.exit(1)
    }

    console.log(`✅ Kullanıcı bulundu: ${user.email} (${user.id})\n`)

    // 2. Service instance'ları oluştur
    const inventoryService = new InventoryService()
    const postService = new PostService()

    // 3. Popüler intersection ürünlerini getir
    const popularBrandWhere = POPULAR_BRAND_NAMES.map((name) => ({
      name: { equals: name, mode: 'insensitive' as const },
    }))
    const popularCategoryWhere = POPULAR_CATEGORY_NAMES.map((name) => ({
      name: { equals: name, mode: 'insensitive' as const },
    }))

    const allProducts = await prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      take: 100,
      where: {
        AND: [
          { brand: { is: { OR: popularBrandWhere } } },
          { category: { is: { OR: popularCategoryWhere } } },
        ],
      },
    })

    const basePool = allProducts.filter(p => Boolean(p.brand?.name) && Boolean(p.category?.name))
    const intersectionPool = basePool.filter(p => isPopularIntersectionProduct(p))

    if (intersectionPool.length === 0) {
      console.error('❌ Popüler intersection ürün bulunamadı')
      process.exit(1)
    }

    // 4. 2 ürün seç (kullanıcının mevcut inventory'sinde olmayan)
    const existingInventories = await prisma.inventory.findMany({
      where: { userId: user.id },
      select: { productId: true },
    })
    const existingProductIds = new Set(existingInventories.map(inv => inv.productId))

    const availableProducts = intersectionPool.filter(p => !existingProductIds.has(p.id))
    const selectedProducts = availableProducts
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)

    if (selectedProducts.length === 0) {
      console.error('❌ Seçilebilir ürün bulunamadı (tüm ürünler zaten inventory\'de olabilir)')
      process.exit(1)
    }

    console.log(`📦 ${selectedProducts.length} ürün seçildi:\n`)
    selectedProducts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.brand?.name || 'N/A'}) - ${p.category?.name || 'N/A'}`)
    })
    console.log()

    // 5. Her ürün için experience post akışını çalıştır
    let successCount = 0
    let failCount = 0

    for (const product of selectedProducts) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📝 İşleniyor: ${product.name}`)
      console.log('='.repeat(80))

      try {
        // 5.1. Inventory oluştur
        console.log('  1️⃣  Inventory oluşturuluyor...')
        const inventory = await prisma.inventory.upsert({
          where: {
            userId_productId: {
              userId: user.id,
              productId: product.id,
            },
          },
          create: {
            userId: user.id,
            productId: product.id,
            hasOwned: true,
            experienceSummary: `Bu ${product.name} ürününü kullanıyorum. Deneyimlerimi paylaşacağım.`,
          },
          update: {
            hasOwned: true,
          },
        })
        console.log(`     ✅ Inventory oluşturuldu: ${inventory.id}`)

        // 5.2. Experience options al
        console.log('  2️⃣  Experience options alınıyor...')
        const experienceOptions = await inventoryService.getExperienceOptions()

        if (experienceOptions.durations.length === 0 || experienceOptions.locations.length === 0 || experienceOptions.purposes.length === 0) {
          console.log(`     ⚠️  Experience options eksik, atlanıyor`)
          failCount++
          continue
        }

        // 5.3. Rastgele duration, location, purpose seç
        const selectedDuration = experienceOptions.durations[Math.floor(Math.random() * experienceOptions.durations.length)]
        const selectedLocation = experienceOptions.locations[Math.floor(Math.random() * experienceOptions.locations.length)]
        const selectedPurpose = experienceOptions.purposes[Math.floor(Math.random() * experienceOptions.purposes.length)]

        console.log(`     ✅ Seçimler yapıldı:`)
        console.log(`        - Duration: ${selectedDuration.name}`)
        console.log(`        - Location: ${selectedLocation.name}`)
        console.log(`        - Purpose: ${selectedPurpose.name}`)

        // 5.4. Experience text oluştur
        console.log('  3️⃣  Experience text oluşturuluyor...')
        let experienceText: string
        try {
          const geminiService = GeminiService.getInstance()
          const experienceTemplates = [
            `${product.name}${product.brand?.name ? ` (${product.brand.name})` : ''} ürününü ${selectedDuration.name} süredir ${selectedLocation.name} konumunda ${selectedPurpose.name} amacıyla kullanıyorum. Ürünü satın alırken fiyatı makul buldum ve alışveriş deneyimi sorunsuz geçti. Kullanım açısından performansı oldukça iyi, günlük ihtiyaçlarımı karşılıyor ve beklentilerimi aşıyor.`,
            `${product.name} ürününü ${selectedDuration.name} süredir ${selectedLocation.name} ortamında ${selectedPurpose.name} için kullanıyorum. Satın alma sürecinde fiyatı uygun buldum ve hızlı teslimat aldım. Ürün kalitesi beklentilerimi karşıladı, kullanımı kolay ve pratik. Genel olarak memnun kaldım.`,
            `${product.name}${product.brand?.name ? ` markasının` : ''} bu ürününü ${selectedDuration.name} süredir ${selectedLocation.name} konumunda ${selectedPurpose.name} amacıyla kullanıyorum. Fiyat-performans oranı iyi, alışveriş deneyimi profesyonel. Ürünün işlevselliği ve dayanıklılığı beni etkiledi. Tavsiye ederim.`,
          ]

          // Rastgele bir template seç veya Gemini ile oluştur
          if (Math.random() < 0.3) {
            // %30 şansla Gemini kullan
            const geminiResult = await geminiService.generatePostContent({
              postType: 'EXPERIENCE',
              persona: 'tech enthusiast',
              productName: product.name,
              productBrand: product.brand?.name,
              productDescription: product.description || undefined,
            })
            experienceText = geminiResult.body
            console.log(`     ✅ Gemini ile oluşturuldu (${experienceText.length} karakter)`)
          } else {
            // %70 şansla template kullan
            experienceText = experienceTemplates[Math.floor(Math.random() * experienceTemplates.length)]
            console.log(`     ✅ Template ile oluşturuldu (${experienceText.length} karakter)`)
          }
        } catch (error) {
          // Fallback: Basit template kullan
          experienceText = `${product.name}${product.brand?.name ? ` (${product.brand.name})` : ''} ürününü ${selectedDuration.name} süredir ${selectedLocation.name} konumunda ${selectedPurpose.name} amacıyla kullanıyorum. Ürünün kalitesi ve performansı beni memnun etti. Fiyat-performans oranı oldukça iyi. Günlük kullanımda sorunsuz çalışıyor ve beklentilerimi karşılıyor.`
          console.log(`     ⚠️  Gemini hatası, fallback template kullanıldı`)
        }

        if (!experienceText || experienceText.trim().length < 10) {
          console.log(`     ⚠️  Experience text oluşturulamadı, atlanıyor`)
          failCount++
          continue
        }

        // 5.5. splitExperienceWithAI çağır
        console.log('  4️⃣  Experience text AI ile ayrılıyor...')
        const splitResult = await inventoryService.splitExperienceWithAI(
          user.id,
          product.id,
          experienceText
        )
        console.log(`     ✅ Experience ayrıldı (snippet ID: ${splitResult.experienceSnippetId})`)

        // 5.6. Inventory'yi güncelle
        console.log('  5️⃣  Inventory güncelleniyor...')
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: {
            experienceSnippetId: splitResult.experienceSnippetId,
            experienceDurationId: selectedDuration.id,
            experienceLocationId: selectedLocation.id,
            experiencePurposeId: selectedPurpose.id,
            experienceSummary: experienceText.substring(0, 200),
          },
        })
        console.log(`     ✅ Inventory güncellendi`)

        // 5.7. Experience array oluştur
        console.log('  6️⃣  Experience array oluşturuluyor...')
        const experienceArray: Experience[] = []
        if (splitResult.priceAndShopping?.content) {
          experienceArray.push({
            type: ExperienceType.PRICE_AND_SHOPPING,
            content: splitResult.priceAndShopping.content,
            rating: splitResult.priceAndShopping.rating || 4,
          })
        }
        if (splitResult.productAndUsage?.content) {
          experienceArray.push({
            type: ExperienceType.PRODUCT_AND_USAGE,
            content: splitResult.productAndUsage.content,
            rating: splitResult.productAndUsage.rating || 4,
          })
        }

        if (experienceArray.length === 0) {
          console.log(`     ⚠️  Experience array boş, atlanıyor`)
          failCount++
          continue
        }

        console.log(`     ✅ ${experienceArray.length} experience oluşturuldu`)

        // 5.8. createExperiencePost ile EXPERIENCE tipinde ContentPost oluştur
        console.log('  7️⃣  Experience post oluşturuluyor...')
        const postResult = await postService.createExperiencePost(user.id, {
          contextType: ContextType.PRODUCT,
          contextId: product.id,
          selectedDurationId: selectedDuration.id,
          selectedLocationId: selectedLocation.id,
          selectedPurposeId: selectedPurpose.id,
          content: experienceText,
          experience: experienceArray,
          status: ExperienceStatus.OWN,
          experienceSnippetId: splitResult.experienceSnippetId,
        })

        console.log(`     ✅ Experience post oluşturuldu: ${postResult.id}`)
        successCount++

      } catch (error) {
        console.error(`     ❌ Hata: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
          console.error(`     Stack: ${error.stack}`)
        }
        failCount++
      }
    }

    // 6. Özet
    console.log('\n' + '='.repeat(80))
    console.log('✨ TEST TAMAMLANDI\n')
    console.log(`   ✅ Başarılı: ${successCount}`)
    console.log(`   ❌ Başarısız: ${failCount}`)
    console.log('='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ Script hatası:', error)
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
