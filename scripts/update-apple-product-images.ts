import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Apple ürün görselleri klasörü
const APPLE_PRODUCTS_DIR = path.join(__dirname, '../tests/assets/Apple_Products');

// Apple ürün isimlerine göre görsel eşleştirmeleri
// Dosya isimlerinden ürün isimlerini çıkar: apple-product-iphone17pro.png -> iPhone 17 Pro
const APPLE_PRODUCT_IMAGE_MAP: Record<string, string> = {
  'iPhone 17': 'apple-product-iphone17.png',
  'iPhone 17 Pro': 'apple-product-iphone17pro.png',
  'iPhone 16e': 'apple-product-iphone16e.png',
  'iPhone Air': 'apple-product-iphoneair.png',
  'AirPods 4': 'apple-product-airpods4.png',
  'AirPods 4 ANC': 'apple-product-airpods4ANC.png',
  'AirPods Max': 'apple-product-airpodsmax.png',
  'AirPods Pro 3': 'apple-product-airpodspro3.png',
  'Watch SE 3': 'apple-product-watchse3.png',
  'Watch Series 11': 'apple-product-watchseries11.png',
  'Watch Ultra 3': 'apple-product-watchultra3.png',
  // Alternatif isimler
  'Apple iPhone 17': 'apple-product-iphone17.png',
  'Apple iPhone 17 Pro': 'apple-product-iphone17pro.png',
  'Apple iPhone 16e': 'apple-product-iphone16e.png',
  'Apple iPhone Air': 'apple-product-iphoneair.png',
  'Apple AirPods 4': 'apple-product-airpods4.png',
  'Apple AirPods 4 ANC': 'apple-product-airpods4ANC.png',
  'Apple AirPods Max': 'apple-product-airpodsmax.png',
  'Apple AirPods Pro 3': 'apple-product-airpodspro3.png',
  'Apple Watch SE 3': 'apple-product-watchse3.png',
  'Apple Watch Series 11': 'apple-product-watchseries11.png',
  'Apple Watch Ultra 3': 'apple-product-watchultra3.png',
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

// Ürün ismine göre görsel dosyasını bul
function findAppleProductImage(productName: string): string | null {
  // Önce tam eşleşme
  if (APPLE_PRODUCT_IMAGE_MAP[productName]) {
    return APPLE_PRODUCT_IMAGE_MAP[productName];
  }

  // Kısmi eşleşme (örneğin "Apple K4" -> "iPhone" içeriyorsa)
  const normalizedName = productName.toLowerCase();
  for (const [key, value] of Object.entries(APPLE_PRODUCT_IMAGE_MAP)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedName.includes(normalizedKey.split(' ')[0]) || normalizedKey.includes(normalizedName.split(' ')[0])) {
      return value;
    }
  }

  // Rastgele bir Apple görseli seç (fallback)
  const appleImages = readdirSync(APPLE_PRODUCTS_DIR).filter(file => 
    file.startsWith('apple-product-') && /\.(png|jpg|jpeg)$/i.test(file)
  );
  if (appleImages.length > 0) {
    // Product name'e göre deterministik rastgele seçim
    let hash = 0;
    for (let i = 0; i < productName.length; i++) {
      hash = ((hash << 5) - hash) + productName.charCodeAt(i);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % appleImages.length;
    return appleImages[index];
  }

  return null;
}

async function updateAppleProductImages(): Promise<void> {
  console.log('🍎 Apple ürün görselleri güncelleniyor...\n');

  try {
    // Apple brand'ini bul
    const appleBrand = await prisma.brand.findFirst({
      where: { name: 'Apple' },
    });

    if (!appleBrand) {
      console.warn('⚠️  Apple brand bulunamadı!');
      return;
    }

    console.log(`✅ Apple brand bulundu: ${appleBrand.id}\n`);

    // Apple brand'ine ait tüm ürünleri al
    const products = await prisma.product.findMany({
      where: {
        brand: appleBrand.name,
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

    if (products.length === 0) {
      console.warn('⚠️  Apple ürünü bulunamadı!');
      return;
    }

    console.log(`📋 ${products.length} Apple ürünü bulundu\n`);

    let updatedProductCount = 0;
    let updatedPostMediaCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const imageFileName = findAppleProductImage(product.name);

      if (!imageFileName) {
        console.warn(`   ⚠️  ${product.name} için görsel bulunamadı`);
        skippedCount++;
        continue;
      }

      const imagePath = path.join(APPLE_PRODUCTS_DIR, imageFileName);

      // Dosya var mı kontrol et
      try {
        readFileSync(imagePath);
      } catch (error) {
        console.warn(`   ⚠️  ${product.name} için görsel dosyası bulunamadı: ${imagePath}`);
        skippedCount++;
        continue;
      }

      // MinIO'ya yüklenecek path
      const targetKey = `products/apple/${imageFileName}`;

      // MinIO'da zaten var mı kontrol et
      const fileExists = await s3Service.fileExists(targetKey);
      if (!fileExists) {
        // Görseli oku ve MinIO'ya yükle
        const fileBuffer = readFileSync(imagePath);
        const contentType = inferContentType(imagePath);

        await s3Service.uploadFile(targetKey, fileBuffer, contentType);
        console.log(`   ✅ ${imageFileName} MinIO'ya yüklendi: ${targetKey}`);
      } else {
        console.log(`   ⏭️  ${imageFileName} zaten MinIO'da mevcut: ${targetKey}`);
      }

      // DB'de product.imageUrl'i güncelle
      if (product.imageUrl !== targetKey) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: targetKey },
        });
        console.log(`   ✅ Product: ${product.name} -> ${targetKey}`);
        updatedProductCount++;
      }

      // Bu ürüne ait PostMedia kayıtlarını bul ve güncelle
      // Önce bu ürüne ait post'ları bul
      const posts = await prisma.contentPost.findMany({
        where: { productId: product.id },
        select: { id: true },
      });

      if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        
        // Bu post'lara ait PostMedia kayıtlarını bul
        const postMediaRecords = await prisma.postMedia.findMany({
          where: {
            postId: { in: postIds },
            // Eğer görsel zaten Apple görseli değilse güncelle
            mediaUrl: {
              not: {
                startsWith: 'products/apple/',
              },
            },
          },
        });

        // PostMedia kayıtlarını güncelle
        for (const postMedia of postMediaRecords) {
          await prisma.postMedia.update({
            where: { id: postMedia.id },
            data: { mediaUrl: targetKey },
          });
          updatedPostMediaCount++;
        }

        if (postMediaRecords.length > 0) {
          console.log(`   ✅ ${postMediaRecords.length} PostMedia kaydı güncellendi`);
        }
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Güncellenen product: ${updatedProductCount}`);
    console.log(`   ✅ Güncellenen PostMedia: ${updatedPostMediaCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);

    console.log('\n✨ Apple ürün görsel güncelleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
updateAppleProductImages()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

