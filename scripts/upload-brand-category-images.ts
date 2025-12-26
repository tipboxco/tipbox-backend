import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Catalog görselleri klasörü
const CATALOG_IMAGES_DIR = path.join(__dirname, '../tests/assets/catalog');

// Brand category isimlerine göre görsel eşleştirmeleri
const BRAND_CATEGORY_IMAGE_MAP: Record<string, string> = {
  'Automotive': 'otomotiv.png',
  'Baby': 'kucukev.png', // Bebek ürünleri için ev görseli
  'Beauty': 'cameras.png', // Güzellik ürünleri için kamera görseli
  'Electronics': 'phones.png',
  'Fashion': 'headphones.png', // Moda aksesuarları için
  'Gaming': 'games.png',
  'Health & Fitness': 'headphones.png', // Fitness kulaklıkları için
  'Home & Living': 'home appliances.png',
  'Kitchen': 'home appliances.png',
  'Outdoor': 'drone.png', // Açık hava ürünleri için
  'Pets': 'kucukev.png', // Evcil hayvan ürünleri için ev görseli
  'Sustainability': 'smart home devices.png', // Sürdürülebilir teknoloji için
  'Technology': 'computers-tablets.png',
  'Travel': 'cameras.png', // Seyahat kameraları için
};

// Content type belirleme
function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

async function uploadBrandCategoryImages(): Promise<void> {
  console.log('📤 Brand category görselleri yükleniyor...\n');

  try {
    // Tüm brand categories'i al
    const categories = await prisma.brandCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      console.warn('⚠️  Brand category bulunamadı!');
      return;
    }

    console.log(`📋 ${categories.length} brand category bulundu\n`);

    let uploadedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const category of categories) {
      const imageFileName = BRAND_CATEGORY_IMAGE_MAP[category.name];

      if (!imageFileName) {
        console.warn(`   ⚠️  ${category.name} için görsel eşleştirmesi bulunamadı`);
        skippedCount++;
        continue;
      }

      const imagePath = path.join(CATALOG_IMAGES_DIR, imageFileName);

      // Dosya var mı kontrol et
      try {
        readFileSync(imagePath);
      } catch (error) {
        console.warn(`   ⚠️  ${category.name} için görsel bulunamadı: ${imagePath}`);
        skippedCount++;
        continue;
      }

      // MinIO'ya yüklenecek path
      const targetKey = `brand-categories/${imageFileName}`;

      // MinIO'da zaten var mı kontrol et
      const fileExists = await s3Service.fileExists(targetKey);
      if (!fileExists) {
        // Görseli oku ve MinIO'ya yükle
        const fileBuffer = readFileSync(imagePath);
        const contentType = inferContentType(imagePath);

        await s3Service.uploadFile(targetKey, fileBuffer, contentType);
        console.log(`   ✅ ${imageFileName} MinIO'ya yüklendi: ${targetKey}`);
        uploadedCount++;
      } else {
        console.log(`   ⏭️  ${imageFileName} zaten MinIO'da mevcut: ${targetKey}`);
      }

      // DB'de imageUrl'i güncelle
      if (category.imageUrl !== targetKey) {
        await prisma.brandCategory.update({
          where: { id: category.id },
          data: { imageUrl: targetKey },
        });
        console.log(`   ✅ ${category.name} -> ${targetKey}`);
        updatedCount++;
      } else {
        console.log(`   ⏭️  ${category.name} zaten doğru görsele sahip`);
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ MinIO'ya yüklenen: ${uploadedCount}`);
    console.log(`   ✅ DB'de güncellenen: ${updatedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);

    console.log('\n✨ Brand category görsel yükleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
uploadBrandCategoryImages()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

