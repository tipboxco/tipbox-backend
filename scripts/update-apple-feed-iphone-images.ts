import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Apple brand ID
const APPLE_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028';

// iPhone görselleri (rastgele seçim için)
const IPHONE_IMAGES = [
  'apple-product-iphone17.png',
  'apple-product-iphone17pro.png',
  'apple-product-iphone16e.png',
  'apple-product-iphoneair.png',
];

// Apple Products klasörü
const APPLE_PRODUCTS_DIR = path.join(__dirname, '../tests/assets/Apple_Products');

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

// Rastgele iPhone görseli seç (deterministik - post ID'ye göre)
function getRandomIphoneImage(postId: string): string {
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = ((hash << 5) - hash) + postId.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % IPHONE_IMAGES.length;
  return IPHONE_IMAGES[index];
}

async function updateAppleFeedIphoneImages(): Promise<void> {
  console.log('🍎 Apple brand feed iPhone görselleri güncelleniyor...\n');

  try {
    // Apple brand'ini kontrol et
    const appleBrand = await prisma.brand.findUnique({
      where: { id: APPLE_BRAND_ID },
    });

    if (!appleBrand) {
      console.warn(`⚠️  Apple brand bulunamadı: ${APPLE_BRAND_ID}`);
      return;
    }

    console.log(`✅ Apple brand bulundu: ${appleBrand.name}\n`);

    // Apple brand'ine ait tüm ürünleri bul (iPhone içeren veya Apple ile başlayan)
    const appleProducts = await prisma.product.findMany({
      where: {
        brand: appleBrand.name,
        OR: [
          {
            name: {
              contains: 'iPhone',
              mode: 'insensitive',
            },
          },
          {
            name: {
              startsWith: 'Apple',
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (appleProducts.length === 0) {
      console.warn('⚠️  Apple iPhone ürünü bulunamadı!');
      return;
    }

    console.log(`📋 ${appleProducts.length} iPhone ürünü bulundu\n`);

    const productIds = appleProducts.map(p => p.id);

    // Bu ürünlere ait post'ları bul
    const posts = await prisma.contentPost.findMany({
      where: {
        productId: { in: productIds },
      },
      select: {
        id: true,
        productId: true,
      },
    });

    if (posts.length === 0) {
      console.warn('⚠️  iPhone ürünlerine ait post bulunamadı!');
      return;
    }

    console.log(`📝 ${posts.length} post bulundu\n`);

    let updatedCount = 0;
    let uploadedCount = 0;

    // Her post için PostMedia kayıtlarını güncelle
    for (const post of posts) {
      // Bu post'a ait PostMedia kayıtlarını bul
      const postMediaRecords = await prisma.postMedia.findMany({
        where: {
          postId: post.id,
          // Sadece iPhone görsellerini güncelle (zaten iPhone görseli olanları değiştir)
          mediaUrl: {
            contains: 'apple-product-iphone',
          },
        },
      });

      if (postMediaRecords.length === 0) {
        // Eğer PostMedia yoksa, yeni bir tane oluştur
        const randomImage = getRandomIphoneImage(post.id);
        const imagePath = path.join(APPLE_PRODUCTS_DIR, randomImage);
        const targetKey = `products/apple/${randomImage}`;

        try {
          // MinIO'da var mı kontrol et
          const fileExists = await s3Service.fileExists(targetKey);
          if (!fileExists) {
            const fileBuffer = readFileSync(imagePath);
            const contentType = inferContentType(imagePath);
            await s3Service.uploadFile(targetKey, fileBuffer, contentType);
            console.log(`   ✅ ${randomImage} MinIO'ya yüklendi: ${targetKey}`);
            uploadedCount++;
          }

          // PostMedia oluştur
          await prisma.postMedia.create({
            data: {
              postId: post.id,
              userId: postMediaRecords[0]?.userId || '480f5de9-b691-4d70-a6a8-2789226f4e07', // Fallback user
              mediaUrl: targetKey,
              orderIndex: 0,
            },
          });
          console.log(`   ✅ PostMedia oluşturuldu: ${post.id} -> ${targetKey}`);
          updatedCount++;
        } catch (error: any) {
          console.warn(`   ⚠️  Post ${post.id} için görsel eklenemedi: ${error.message}`);
        }
      } else {
        // Mevcut PostMedia kayıtlarını güncelle
        for (const postMedia of postMediaRecords) {
          const randomImage = getRandomIphoneImage(post.id);
          const imagePath = path.join(APPLE_PRODUCTS_DIR, randomImage);
          const targetKey = `products/apple/${randomImage}`;

          // Eğer zaten aynı görselse atla
          if (postMedia.mediaUrl === targetKey) {
            continue;
          }

          try {
            // MinIO'da var mı kontrol et
            const fileExists = await s3Service.fileExists(targetKey);
            if (!fileExists) {
              const fileBuffer = readFileSync(imagePath);
              const contentType = inferContentType(imagePath);
              await s3Service.uploadFile(targetKey, fileBuffer, contentType);
              console.log(`   ✅ ${randomImage} MinIO'ya yüklendi: ${targetKey}`);
              uploadedCount++;
            }

            // PostMedia'yı güncelle
            await prisma.postMedia.update({
              where: { id: postMedia.id },
              data: { mediaUrl: targetKey },
            });
            console.log(`   ✅ PostMedia güncellendi: ${post.id} -> ${targetKey}`);
            updatedCount++;
          } catch (error: any) {
            console.warn(`   ⚠️  PostMedia ${postMedia.id} güncellenemedi: ${error.message}`);
          }
        }
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Güncellenen PostMedia: ${updatedCount}`);
    console.log(`   ✅ MinIO'ya yüklenen: ${uploadedCount}`);

    console.log('\n✨ Apple brand feed iPhone görsel güncelleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
updateAppleFeedIphoneImages()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

