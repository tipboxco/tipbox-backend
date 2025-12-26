/**
 * Event'e post'lar ekleyen script
 * 
 * Kullanım:
 *   npx ts-node scripts/add-posts-to-event.ts <eventId>
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

// ULID generator (seed.ts'den)
function generateUlid(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0');
  return (timestamp + randomPart).substring(0, 26);
}

const prisma = new PrismaClient();
const s3Service = new S3Service();

const EVENT_ID = process.argv[2] || '00MJMTQ06M00000ELNABD7I3NB';
const POST_COUNT = parseInt(process.argv[3] || '6', 10);

// Test kullanıcıları (seed'den)
const TEST_USER_IDS = [
  '480f5de9-b691-4d70-a6a8-2789226f4e07', // omer@tipbox.co
  '11111111-1111-4111-a111-111111111111', // trust-user-0
  '22222222-2222-4222-a222-222222222222', // trust-user-1
  '33333333-3333-4333-a333-333333333333', // trust-user-2
];

// Post görselleri klasörü
const POST_IMAGES_DIR = path.join(process.cwd(), 'tests', 'assets', 'product');

// Content type inference
function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

async function addPostsToEvent(): Promise<void> {
  console.log(`📝 Event'e post'lar ekleniyor: ${EVENT_ID}\n`);

  try {
    // Event'i kontrol et
    const event = await prisma.wishboxEvent.findUnique({
      where: { id: EVENT_ID },
      include: {
        scenarios: {
          include: {
            choices: true,
          },
        },
      },
    });

    if (!event) {
      console.error(`❌ Event bulunamadı: ${EVENT_ID}`);
      process.exit(1);
    }

    console.log(`✅ Event bulundu: ${event.title}\n`);

    // Event'in category'sini al (eğer varsa)
    const mainCategory = await prisma.mainCategory.findFirst({
      where: { name: 'Teknoloji' }, // Varsayılan kategori
    });

    const subCategory = mainCategory
      ? await prisma.subCategory.findFirst({
          where: { mainCategoryId: mainCategory.id },
        })
      : null;

    const productGroup = subCategory
      ? await prisma.productGroup.findFirst({
          where: { subCategoryId: subCategory.id },
        })
      : null;

    const product = productGroup
      ? await prisma.product.findFirst({
          where: { groupId: productGroup.id },
        })
      : null;

    // Post görsellerini al (6 post için)
    const postImageFiles = readdirSync(POST_IMAGES_DIR)
      .filter((file) => /\.(jpg|jpeg|png)$/i.test(file))
      .slice(0, POST_COUNT); // İstenen sayıda görseli kullan

    console.log(`📸 ${postImageFiles.length} post görseli bulundu\n`);

    let createdPosts = 0;
    let createdMedia = 0;

    // Belirtilen sayıda post oluştur
    for (let i = 0; i < POST_COUNT && i < postImageFiles.length; i++) {
      // Kullanıcıları döngüsel olarak kullan
      const userId = TEST_USER_IDS[i % TEST_USER_IDS.length];
      const imageFile = postImageFiles[i];

        // Post görselini MinIO'ya yükle
        const imagePath = path.join(POST_IMAGES_DIR, imageFile);
        const postId = generateUlid();
        const mediaKey = `posts/${postId}/${imageFile}`;

      try {
        // MinIO'da zaten var mı kontrol et
        const existsInMinio = await s3Service.fileExists(mediaKey);
        if (!existsInMinio) {
          const fileBuffer = readFileSync(imagePath);
          const contentType = inferContentType(imagePath);
          await s3Service.uploadFile(mediaKey, fileBuffer, contentType);
          console.log(`   ✅ Görsel yüklendi: ${mediaKey}`);
        }

        // Post oluştur
        const post = await prisma.contentPost.create({
          data: {
            id: postId,
            userId: userId,
            type: 'EXPERIENCE',
            title: `${event.title} - Deneyim Paylaşımı ${i + 1}`,
            body: `Bu event için harika bir deneyim paylaşıyorum! ${event.description || ''}`,
            mainCategoryId: mainCategory?.id || null,
            subCategoryId: subCategory?.id || null,
            productGroupId: productGroup?.id || null,
            productId: product?.id || null,
            inventoryRequired: false,
            isBoosted: false,
          },
        });

        // PostMedia ekle
        await prisma.postMedia.create({
          data: {
            postId: post.id,
            userId: userId,
            mediaUrl: mediaKey,
            orderIndex: 0,
          },
        });

        console.log(`   ✅ Post oluşturuldu: ${post.title} (${post.id})`);
        createdPosts++;
        createdMedia++;

        // Event'in scenario'suna choice ekle (eğer scenario yoksa oluştur)
        if (event.scenarios.length === 0) {
          // İlk scenario'yu oluştur
          const scenario = await prisma.wishboxScenario.create({
            data: {
              eventId: event.id,
              title: 'Bu event hakkında ne düşünüyorsunuz?',
              description: 'Event katılım anketi',
              orderIndex: 0,
            },
          });

          // Choice ekle
          await prisma.scenarioChoice.create({
            data: {
              scenarioId: scenario.id,
              userId: userId,
              choiceText: 'Katılıyorum',
              isSelected: true,
            },
          });

          console.log(`   ✅ Scenario ve choice eklendi`);
        } else {
          // Mevcut scenario'ya choice ekle
          const scenario = event.scenarios[0];
          const existingChoice = await prisma.scenarioChoice.findFirst({
            where: {
              scenarioId: scenario.id,
              userId: userId,
            },
          });

          if (!existingChoice) {
            await prisma.scenarioChoice.create({
              data: {
                scenarioId: scenario.id,
                userId: userId,
                choiceText: 'Katılıyorum',
                isSelected: true,
              },
            });
            console.log(`   ✅ Choice eklendi`);
          }
        }
      } catch (error: any) {
        console.error(`   ❌ Hata (${imageFile}):`, error.message);
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Oluşturulan post'lar: ${createdPosts}`);
    console.log(`   ✅ Oluşturulan media: ${createdMedia}`);
    console.log('\n✨ Event post ekleme tamamlandi!');
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    throw error;
  }
}

// Script'i çalıştır
addPostsToEvent()
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

