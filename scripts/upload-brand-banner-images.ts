import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Brand banner görselleri klasörü
const BRAND_BANNERS_DIR = path.join(__dirname, '../tests/assets/Brand_Banners');

// Brand isimlerine göre banner görsel eşleştirmeleri
const BRAND_BANNER_MAP: Record<string, string> = {
  'Apple': 'brandpage-electronic-apple.jpg',
  'ASUS': 'brandpage-electronic-asus.jpg',
  'Canon': 'brandpage-electronic-canon.jpg',
  'Dyson': 'brandpage-electronic-dyson.jpg',
  'JBL': 'brandpage-electronic-jbl.jpg',
  'Marshall': 'marshall.jpg',
  'MSI': 'brandpage-electronic-msi.jpg',
  'NVIDIA': 'brandpage-electronic-nvidia.jpg',
  'Samsung': 'brandpage-electronic-samsung.jpg',
  'Shark': 'brandpage-electronic-shark.jpg',
  'SteelSeries': 'brandpage-electronic-steelseries.jpg',
  'Xiaomi': 'brandpage-electronic-xiaomi.jpg',
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
      return 'image/jpeg';
  }
}

async function uploadBrandBannerImages(): Promise<void> {
  console.log('📤 Brand banner görselleri yükleniyor...\n');

  try {
    // Electronics kategorisini bul
    const electronicsCategory = await prisma.brandCategory.findFirst({
      where: { name: 'Electronics' },
    });

    if (!electronicsCategory) {
      console.warn('⚠️  Electronics kategorisi bulunamadı!');
      return;
    }

    console.log(`✅ Electronics kategorisi bulundu: ${electronicsCategory.id}\n`);

    // Electronics kategorisindeki tüm brand'leri al
    const brands = await prisma.brand.findMany({
      where: {
        categoryId: electronicsCategory.id,
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (brands.length === 0) {
      console.warn('⚠️  Electronics kategorisinde brand bulunamadı!');
      return;
    }

    console.log(`📋 ${brands.length} brand bulundu\n`);

    let uploadedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const brand of brands) {
      const bannerFileName = BRAND_BANNER_MAP[brand.name];

      if (!bannerFileName) {
        console.warn(`   ⚠️  ${brand.name} için banner görseli eşleştirmesi bulunamadı`);
        skippedCount++;
        continue;
      }

      const bannerPath = path.join(BRAND_BANNERS_DIR, bannerFileName);

      // Dosya var mı kontrol et
      try {
        readFileSync(bannerPath);
      } catch (error) {
        console.warn(`   ⚠️  ${brand.name} için banner görseli bulunamadı: ${bannerPath}`);
        skippedCount++;
        continue;
      }

      // MinIO'ya yüklenecek path
      const targetKey = `brands/banners/${bannerFileName}`;

      // MinIO'da zaten var mı kontrol et
      const fileExists = await s3Service.fileExists(targetKey);
      if (!fileExists) {
        // Görseli oku ve MinIO'ya yükle
        const fileBuffer = readFileSync(bannerPath);
        const contentType = inferContentType(bannerPath);

        await s3Service.uploadFile(targetKey, fileBuffer, contentType);
        console.log(`   ✅ ${bannerFileName} MinIO'ya yüklendi: ${targetKey}`);
        uploadedCount++;
      } else {
        console.log(`   ⏭️  ${bannerFileName} zaten MinIO'da mevcut: ${targetKey}`);
      }

      // DB'de imageUrl'i güncelle
      if (brand.imageUrl !== targetKey) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { imageUrl: targetKey },
        });
        console.log(`   ✅ ${brand.name} -> ${targetKey}`);
        updatedCount++;
      } else {
        console.log(`   ⏭️  ${brand.name} zaten doğru görsele sahip`);
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ MinIO'ya yüklenen: ${uploadedCount}`);
    console.log(`   ✅ DB'de güncellenen: ${updatedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);

    console.log('\n✨ Brand banner görsel yükleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
uploadBrandBannerImages()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

