#!/usr/bin/env node

/**
 * Product Varlık Kontrolü Script
 * 
 * Kullanım:
 * node scripts/check-product-exists.js <productId>
 * 
 * Örnek:
 * node scripts/check-product-exists.js 0462b7da-0e4d-48b2-8a54-0412a7d971b5
 */

const { PrismaClient } = require('@prisma/client');

const productId = process.argv[2];

if (!productId) {
  console.error('❌ Kullanım: node scripts/check-product-exists.js <productId>');
  console.error('Örnek: node scripts/check-product-exists.js 0462b7da-0e4d-48b2-8a54-0412a7d971b5');
  process.exit(1);
}

const prisma = new PrismaClient();

async function checkProduct() {
  try {
    console.log(`🔍 Product kontrolü yapılıyor: ${productId}\n`);
    
    // Product'ı bul
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      console.log('❌ SONUÇ: Product BULUNAMADI!\n');
      console.log('Bu product database\'de yok. Olası sebepler:');
      console.log('  1. Product silinmiş');
      console.log('  2. Yanlış product ID gönderilmiş');
      console.log('  3. Cache\'de eski veri var\n');
      
      console.log('Frontend\'e öneriler:');
      console.log('  • Product listesini yenileyin');
      console.log('  • Cache\'i temizleyin');
      console.log('  • Kullanıcıdan tekrar product seçmesini isteyin\n');
      
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('✅ SONUÇ: Product BULUNDU!\n');
    console.log('Product Bilgileri:');
    console.log('─────────────────────────────────────────────────');
    console.log(`ID:          ${product.id}`);
    console.log(`Name:        ${product.name}`);
    console.log(`Brand:       ${product.brand || 'N/A'}`);
    console.log(`Description: ${product.description?.substring(0, 100) || 'N/A'}...`);
    console.log(`Group ID:    ${product.groupId || 'N/A'}`);
    
    if (product.group) {
      console.log(`\nProduct Group:`);
      console.log(`  Name:           ${product.group.name}`);
      console.log(`  Sub-Category:   ${product.group.subCategory?.name || 'N/A'}`);
      console.log(`  Main Category:  ${product.group.subCategory?.mainCategory?.name || 'N/A'}`);
    }
    
    console.log('─────────────────────────────────────────────────');
    console.log('\n✅ Bu product kullanılabilir!\n');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkProduct();
