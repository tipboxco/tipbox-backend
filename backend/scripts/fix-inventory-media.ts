/**
 * Fix Inventory Media Script
 * 
 * Mevcut inventory kayıtlarına media ekler.
 * Sadece media olmayan inventory'lere random product görselleri ekler.
 */

import { PrismaClient } from '@prisma/client'
import { getSeedMediaPath, SeedMediaKey } from '../prisma/seed/helpers/media.helper'

const prisma = new PrismaClient()

// Kullanılabilir tüm product görselleri (seed-media-map.json'dan)
const availableProductImages: SeedMediaKey[] = [
  'product.dyson',
  'product.electronic-post-1',
  'product.electronic-post-2',
  'product.electronic-post-3',
  'product.electronic-post-4',
  'product.electronic-post-5',
  'product.electronic-post-6',
  'product.electronic-post-7',
  'product.electronic-post-8',
  'product.electronic-post-9',
  'product.electronic-post-10',
  'product.headphone',
  'product.headphone2',
  'product.macbook',
  'product.makeup-post-1',
  'product.makeup-post-2',
  'product.makeup-post-3',
  'product.makeup-post-4',
  'product.makeup-post-5',
  'product.makeup-post-6',
  'product.makeup-post-7',
  'product.makeup-post-8',
  'product.makeup-post-9',
  'product.makeup-post-10',
  'product.phone1',
  'product.phone2',
  'product.phone3',
  'product.phone4',
  'product.phone5',
  'product.phone6',
  'product.samsun',
  'product.smartwatch',
]

async function fixInventoryMedia() {
  console.log('🔧 Inventory Media Fix Script Başlıyor...\n')
  
  // Tüm inventory'leri getir
  const inventories = await prisma.inventory.findMany({
    include: {
      product: true,
      media: true,
    }
  })
  
  console.log(`📦 Toplam ${inventories.length} inventory bulundu`)
  
  let addedMedia = 0
  let skippedExisting = 0
  let skippedNoImage = 0
  let errors = 0
  
  // Her inventory için media kontrolü yap
  for (const inventory of inventories) {
    // Zaten media varsa atla
    if (inventory.media.length > 0) {
      skippedExisting++
      continue
    }
    
    // %80 oranında media ekle
    if (Math.random() > 0.2) {
      let mediaUrl: string | null = null
      
      // Önce ürünün kendi görselini kullanmayı dene
      if (inventory.product.imageUrl) {
        mediaUrl = inventory.product.imageUrl
      } else {
        // Ürün görseli yoksa random product image seç
        const randomImageKey = availableProductImages[Math.floor(Math.random() * availableProductImages.length)]
        mediaUrl = getSeedMediaPath(randomImageKey, true)
      }
      
      if (mediaUrl) {
        try {
          await prisma.inventoryMedia.create({
            data: {
              inventoryId: inventory.id,
              mediaUrl,
            }
          })
          addedMedia++
          
          // Her 50 kayıtta bir progress göster
          if (addedMedia % 50 === 0) {
            console.log(`   ✅ ${addedMedia} media eklendi...`)
          }
        } catch (error) {
          console.error(`   ❌ Hata (inventory ${inventory.id}):`, error)
          errors++
        }
      } else {
        skippedNoImage++
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80))
  console.log('✨ INVENTORY MEDIA FIX TAMAMLANDI\n')
  console.log(`   ✅ Eklenen Media: ${addedMedia}`)
  console.log(`   ⏭️  Mevcut Media (Atlanan): ${skippedExisting}`)
  console.log(`   ⚠️  Görsel Bulunamayan: ${skippedNoImage}`)
  console.log(`   ❌ Hata: ${errors}`)
  console.log(`   📊 Yeni Media Oranı: ${(((addedMedia + skippedExisting) / inventories.length) * 100).toFixed(1)}%`)
  console.log('═'.repeat(80) + '\n')
}

async function main() {
  try {
    await fixInventoryMedia()
  } catch (error) {
    console.error('❌ Script hatası:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

