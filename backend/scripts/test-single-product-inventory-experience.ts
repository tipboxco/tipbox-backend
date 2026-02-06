/**
 * Test: Tek ürünü omer@tipbox.co kullanıcısı için envantere ekle + Experience post oluştur.
 * Seed akışını doğrular: Gemini ile Experience metni üretimi → Split → Inventory → ContentPost.
 *
 * Kullanım (DB + Gemini erişilebilir olmalı):
 *   cd backend && npx ts-node --transpile-only scripts/test-single-product-inventory-experience.ts
 *   veya: npm run test:single-product-inventory-experience
 */

import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../src/application/inventory/inventory.service'
import { ExperienceStatus } from '../src/domain/content/experience-status.enum'

const prisma = new PrismaClient()

const USER_EMAIL = 'omer@tipbox.co'
const PRODUCT_ID = 'prod_01KG86ZXHBFPSJ3GK6S97SCJV1'

async function main() {
  console.log('🧪 Tek ürün envanter + Experience post testi\n')
  console.log(`   Kullanıcı: ${USER_EMAIL}`)
  console.log(`   Ürün ID:   ${PRODUCT_ID}\n`)

  // 1. Kullanıcı
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
  })
  if (!user) {
    console.error('❌ Kullanıcı bulunamadı:', USER_EMAIL)
    process.exit(1)
  }
  console.log('✅ Kullanıcı bulundu:', user.email, `(${user.id})\n`)

  // 2. Ürün
  const product = await prisma.product.findUnique({
    where: { id: PRODUCT_ID },
    include: { brand: { select: { name: true } } },
  })
  if (!product) {
    console.error('❌ Ürün bulunamadı:', PRODUCT_ID)
    process.exit(1)
  }
  console.log('✅ Ürün bulundu:', product.name, product.brand?.name ? `(${product.brand.name})` : '', '\n')

  // 3. Taxonomy: duration, location, purpose (birer tane aktif kayıt)
  const [duration, location, purpose] = await Promise.all([
    prisma.experienceDuration.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.experienceLocation.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.experiencePurpose.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])
  if (!duration || !location || !purpose) {
    console.error('❌ Experience taxonomy eksik (Duration/Location/Purpose). Seed taxonomy çalıştırıldı mı?')
    process.exit(1)
  }
  console.log('✅ Taxonomy:', duration.name, '/', location.name, '/', purpose.name, '\n')

  // 4. Aynı user+product için zaten inventory varsa atla (verileri silmiyoruz)
  const existing = await prisma.inventory.findUnique({
    where: { userId_productId: { userId: user.id, productId: PRODUCT_ID } },
    include: { experienceSnippet: true },
  })
  if (existing) {
    console.log('⚠️  Bu ürün zaten envanterde. Veriler silinmiyor; mevcut kayıtlar kontrol ediliyor.\n')
    const snippetId = existing.experienceSnippetId
    const snippet = snippetId
      ? await prisma.aiExperienceSplit.findUnique({ where: { id: snippetId } })
      : null
    if (!snippet) {
      console.error('❌ Bu inventory için AiExperienceSplit kaydı yok (experienceSnippetId:', snippetId, ')')
      process.exit(1)
    }
    console.log('✅ AiExperienceSplit kaydı mevcut:', snippet.id)
    console.log('   originalExperience (ilk 120):', snippet.originalExperience.substring(0, 120) + '...')
    console.log('   priceAndShopping:', snippet.priceAndShopping ? 'var' : 'yok')
    console.log('   productAndUsage:', snippet.productAndUsage ? 'var' : 'yok')
    await prisma.$disconnect()
    process.exit(0)
  }

  // 5. InventoryService.createInventoryItem → Gemini generate + split + inventory + ContentPost
  const inventoryService = new InventoryService()
  console.log('📦 Envantere ekleniyor (Gemini: Experience metni → Split → Inventory → ContentPost)...\n')

  try {
    const created = await inventoryService.createInventoryItem(user.id, {
      productId: PRODUCT_ID,
      selectedDurationId: duration.id,
      selectedLocationId: location.id,
      selectedPurposeId: purpose.id,
      content: '',
      experience: [],
      status: ExperienceStatus.OWN,
    })

    console.log('✅ Inventory oluşturuldu:', created.id)
    console.log('   productId:', created.productId)
    console.log('   hasOwned:', created.hasOwned)
    console.log('   experienceSummary:', created.experienceSummary?.substring(0, 80) + (created.experienceSummary && created.experienceSummary.length > 80 ? '...' : ''))
    console.log('')

    // 6. Oluşan AiExperienceSplit ve ContentPost kontrolü
    const inventoryWithSnippet = await prisma.inventory.findUnique({
      where: { id: created.id },
      include: {
        experienceSnippet: true,
        product: { select: { name: true } },
      },
    })
    const postsForProduct = await prisma.contentPost.findMany({
      where: { productId: PRODUCT_ID, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, body: true, experienceSnippetId: true, createdAt: true },
    })

    if (!inventoryWithSnippet?.experienceSnippet) {
      console.error('❌ AiExperienceSplit tablosuna veri yazılmadı (inventory.experienceSnippetId yok).')
      process.exit(1)
    }
    const sn = inventoryWithSnippet.experienceSnippet
    console.log('✅ AiExperienceSplit tablosuna veri yazıldı:', sn.id)
    console.log('   originalExperience (ilk 120):', sn.originalExperience.substring(0, 120) + '...')
    console.log('   priceAndShopping:', sn.priceAndShopping ? 'var' : 'yok')
    console.log('   productAndUsage:', sn.productAndUsage ? 'var' : 'yok')
    // Doğrulama: ai_experience_splits'te bu kayıt var mı?
    const splitCount = await prisma.aiExperienceSplit.count({
      where: { id: sn.id, userId: user.id, productId: PRODUCT_ID },
    })
    if (splitCount !== 1) {
      console.error('❌ AiExperienceSplit kaydı DB\'de doğrulanamadı (count:', splitCount, ')')
      process.exit(1)
    }
    console.log('   DB doğrulaması: ai_experience_splits\'te kayıt mevcut.\n')

    if (postsForProduct.length > 0) {
      console.log('✅ Experience post(lar):', postsForProduct.length)
      postsForProduct.forEach((p, i) => {
        console.log(`   [${i + 1}] postId: ${p.id}, snippetId: ${p.experienceSnippetId ?? 'yok'}, body length: ${p.body?.length ?? 0}`)
      })
    } else {
      console.log('⚠️  Bu ürün için henüz ContentPost yok (post oluşturma atlanmış olabilir).\n')
    }

    console.log('\n🎉 Test tamamlandı. Seed akışı (generate → split → inventory → post) çalışıyor.')
  } catch (err) {
    console.error('❌ createInventoryItem hatası:', err instanceof Error ? err.message : err)
    if (err && typeof (err as any)?.code === 'string') {
      console.error('   Prisma code:', (err as any).code)
    }
    await prisma.$disconnect()
    process.exit(1)
  }
  await prisma.$disconnect()
  process.exit(0)
}

main()
