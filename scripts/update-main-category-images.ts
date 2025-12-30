/**
 * Mevcut Main Category görsellerini Product Catalog'dan günceller
 * Bu script seed çalıştırmadan önce veya sonra çalıştırılabilir
 * 
 * Kullanım:
 *   - Docker container içinde: docker-compose exec backend npx ts-node scripts/update-main-category-images.ts
 *   - Local'de: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tipbox_dev npx ts-node scripts/update-main-category-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { getSeedMediaPath } from '../prisma/seed/helpers/media.helper';
import * as dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// DATABASE_URL kontrolü
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL bulunamadı!');
  console.error('   Docker container içinde çalıştırmak için:');
  console.error('   docker-compose exec backend npx ts-node scripts/update-main-category-images.ts');
  console.error('');
  console.error('   Local\'de çalıştırmak için .env dosyasında DATABASE_URL tanımlı olmalı.');
  process.exit(1);
}

const prisma = new PrismaClient();

// Eski Türkçe kategori isimlerinden İngilizce isimlere mapping
const categoryNameMapping: Record<string, string> = {
  'Teknoloji': 'Electronics',
  'Technology': 'Electronics',
  'Ev & Yaşam': 'Home & Living',
  'Gıda & İçecek': 'Kitchen',
  'Moda & Aksesuar': 'Fashion',
  'Sağlık & Güzellik': 'Cosmetics',
  'Spor & Outdoor': 'Sports & Outdoors',
  'Hobi & Eğlence': 'Hobbies & Entertainment',
  'Otomotiv': 'Automotive',
};

// Kategori isimleri ile Product Catalog dosya isimleri eşleştirmesi (tüm isimler İngilizce)
const categoryImageMapping: Record<string, string> = {
  'Cosmetics': 'product-catalog.main-category.cosmetic',
  'Electronics': 'product-catalog.main-category.electronic',
  'Sports & Outdoors': 'product-catalog.main-category.sports-outdoors',
  'Home & Living': 'product-catalog.main-category.home-living',
  'Fashion': 'product-catalog.main-category.fashion',
  'Kitchen': 'product-catalog.main-category.appliances',
  'Hobbies & Entertainment': 'product-catalog.main-category.hobbies-music-art',
  'Automotive': 'product-catalog.main-category.automotive-motorcycle',
  'Baby & Kids': 'product-catalog.main-category.baby-kids',
  'Garden & Hardware': 'product-catalog.main-category.garden-hardware',
  'Office & Stationery': 'product-catalog.main-category.office-stationery',
  'Pet Supplies': 'product-catalog.main-category.pet-supplies',
  'Health & Fitness': 'product-catalog.main-category.cosmetic',
};

async function updateMainCategoryImages(): Promise<void> {
  console.log('🔄 Main Category görselleri Product Catalog\'dan güncelleniyor...\n');
  
  const categories = await prisma.mainCategory.findMany();
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let renamed = 0;
  
  for (const category of categories) {
    // Önce kategori ismini İngilizce'ye çevir (eğer Türkçe ise)
    let englishName = category.name;
    if (categoryNameMapping[category.name]) {
      englishName = categoryNameMapping[category.name];
      // Kategori ismini güncelle
      try {
        await prisma.mainCategory.update({
          where: { id: category.id },
          data: { name: englishName },
        });
        console.log(`  🔄 "${category.name}" → "${englishName}" olarak yeniden adlandırıldı`);
        renamed++;
      } catch (error: any) {
        console.warn(`  ⚠️  "${category.name}" yeniden adlandırılamadı: ${error.message}`);
      }
    }
    
    // Görsel mapping'ini bul
    const imageKey = categoryImageMapping[englishName];
    if (!imageKey) {
      console.warn(`  ⚠️  "${englishName}" için görsel mapping bulunamadı`);
      skipped++;
      continue;
    }
    
    try {
      const imagePath = getSeedMediaPath(imageKey as any, true);
      if (imagePath) {
        if (category.imageUrl !== imagePath) {
          await prisma.mainCategory.update({
            where: { id: category.id },
            data: { imageUrl: imagePath },
          });
          console.log(`  ✅ ${englishName} → ${imagePath}`);
          updated++;
        } else {
          console.log(`  ⏭️  ${englishName} zaten güncel`);
          skipped++;
        }
      } else {
        console.warn(`  ⚠️  ${englishName} için görsel bulunamadı: ${imageKey}`);
        skipped++;
      }
    } catch (error: any) {
      console.error(`  ❌ ${englishName} güncellenirken hata: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n✅ ${updated} kategori görseli güncellendi`);
  if (renamed > 0) {
    console.log(`🔄 ${renamed} kategori yeniden adlandırıldı`);
  }
  console.log(`⏭️  ${skipped} kategori atlandı`);
  if (errors > 0) {
    console.log(`❌ ${errors} kategori güncellenirken hata oluştu`);
  }
  console.log('');
}

async function main() {
  try {
    await updateMainCategoryImages();
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

