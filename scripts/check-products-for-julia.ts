/**
 * Julia'nın post'ları için gerekli product'ları kontrol eden script
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProducts() {
  console.log('🔍 Product kontrolü yapılıyor...\n')

  try {
    // iPhone product
    const iphoneProduct = await prisma.product.findFirst({ 
      where: { name: { contains: 'iPhone' } } 
    }) || await prisma.product.findFirst({ where: { brand: 'Apple' } })
    
    console.log('📱 iPhone/Apple Product:')
    if (iphoneProduct) {
      console.log(`   ✅ Bulundu: ${iphoneProduct.name} (${iphoneProduct.brand})`)
      console.log(`   ID: ${iphoneProduct.id}`)
    } else {
      console.log('   ❌ Bulunamadı!')
    }
    console.log('')

    // Dyson product
    const dysonProduct = await prisma.product.findFirst({ 
      where: { name: { contains: 'Dyson' } } 
    })
    
    console.log('🧹 Dyson Product:')
    if (dysonProduct) {
      console.log(`   ✅ Bulundu: ${dysonProduct.name} (${dysonProduct.brand})`)
      console.log(`   ID: ${dysonProduct.id}`)
    } else {
      console.log('   ❌ Bulunamadı!')
    }
    console.log('')

    // Herhangi bir product
    const anyProduct = await prisma.product.findFirst()
    
    console.log('📦 Herhangi bir Product:')
    if (anyProduct) {
      console.log(`   ✅ Bulundu: ${anyProduct.name} (${anyProduct.brand})`)
      console.log(`   ID: ${anyProduct.id}`)
    } else {
      console.log('   ❌ Bulunamadı!')
    }
    console.log('')

    // Toplam product sayısı
    const totalProducts = await prisma.product.count()
    console.log(`📊 Toplam Product Sayısı: ${totalProducts}`)

    // Kategoriler
    const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
    const phoneSubCategory = await prisma.subCategory.findFirst({ where: { name: 'Akıllı Telefonlar' } })
    
    console.log('\n📂 Kategoriler:')
    console.log(`   Teknoloji: ${techCategory ? '✅' : '❌'}`)
    console.log(`   Akıllı Telefonlar: ${phoneSubCategory ? '✅' : '❌'}`)

    // Sonuç
    const product1 = iphoneProduct || anyProduct
    if (!product1) {
      console.log('\n⚠️  UYARI: Julia\'nın post\'ları için product bulunamadı!')
      console.log('   Seed çalıştırıldığında post\'lar oluşturulmayacak.')
    } else {
      console.log('\n✅ Julia\'nın post\'ları için product mevcut!')
    }

  } catch (error) {
    console.error('❌ Hata:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkProducts()
  .catch((e) => {
    console.error('❌ Script hatası:', e)
    process.exit(1)
  })
