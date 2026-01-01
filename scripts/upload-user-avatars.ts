import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../src/infrastructure/logger/logger';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Kullanıcı ID'leri (seed.ts'den)
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07'; // omer@tipbox.co
const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330'; // markettest@tipbox.co
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999'; // julia@tipbox.co
const COMMUNITY_COACH_USER_ID = '66666666-6666-4666-a666-666666666666'; // coach@tipbox.co

const TRUST_USER_IDS = [
  '11111111-1111-4111-a111-111111111111', // trust-user-0@tipbox.co
  '22222222-2222-4222-a222-222222222222', // trust-user-1@tipbox.co
  '33333333-3333-4333-a333-333333333333', // trust-user-2@tipbox.co
  '44444444-4444-4444-a444-444444444444', // trust-user-3@tipbox.co
  '55555555-5555-4555-a555-555555555555', // trust-user-4@tipbox.co
];

const TRUSTER_USER_IDS = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // truster-user-0@tipbox.co
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // truster-user-1@tipbox.co
  'cccccccc-cccc-4ccc-cccc-cccccccccccc', // truster-user-2@tipbox.co
];

// Avatar eşleştirmesi: [dosya adı, kullanıcı ID, açıklama]
const AVATAR_MAPPING: Array<[string, string, string]> = [
  // Özel kullanıcılar
  ['ozan.jpg', TEST_USER_ID, 'Ömer (Test User)'],
  ['man-user.jpg', TARGET_USER_ID, 'Market Test User'],
  ['woman-user.jpg', JULIA_USER_ID, 'Julia Havk'],
  
  // Trust kullanıcıları (erkek)
  ['man-user-2.png', TRUST_USER_IDS[0], 'Trust User 0'],
  ['man-user-3.jpg', TRUST_USER_IDS[1], 'Trust User 1'],
  ['man-user-4.jpg', TRUST_USER_IDS[2], 'Trust User 2'],
  ['man-user-5.jpg', TRUST_USER_IDS[3], 'Trust User 3'],
  // Trust User 4 için man-user.jpg kullanılabilir (zaten TARGET_USER_ID'ye atandı) veya tekrar kullanılabilir
  
  // Truster kullanıcıları (kadın)
  ['woman-user-2.jpg', TRUSTER_USER_IDS[0], 'Truster User 0'],
  ['woman-user-3.jpg', TRUSTER_USER_IDS[1], 'Truster User 1'],
  ['woman-user-4.jpg', TRUSTER_USER_IDS[2], 'Truster User 2'],
  
  // Community Coach
  ['woman-user-5.jpg', COMMUNITY_COACH_USER_ID, 'Community Coach'],
];

/**
 * Dosya uzantısından MIME type belirle
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Avatar dosyasını MinIO'ya yükle ve database'e kaydet
 */
async function uploadAvatarForUser(
  fileName: string,
  userId: string,
  description: string
): Promise<void> {
  try {
    const assetsPath = path.join(__dirname, '../tests/assets/userprofile', fileName);
    
    if (!existsSync(assetsPath)) {
      console.log(`   ⚠️  Dosya bulunamadı: ${fileName}`);
      return;
    }

    // Dosyayı oku
    const fileBuffer = readFileSync(assetsPath);
    const contentType = getContentType(assetsPath);
    const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
    
    // MinIO'ya yükleme path'i oluştur
    const uuid = uuidv4();
    const objectKey = `profile-pictures/${userId}/${uuid}.${fileExt}`;
    
    console.log(`   📤 MinIO'ya yükleniyor: ${objectKey}`);
    
    // MinIO'ya yükle
    await s3Service.checkAndCreateBucket();
    const uploadedPath = await s3Service.uploadFile(objectKey, fileBuffer, contentType);
    
    console.log(`   ✅ MinIO'ya yüklendi: ${uploadedPath}`);
    
    // Database'de mevcut aktif avatar'ı pasif yap
    await prisma.userAvatar.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    
    // Yeni avatar'ı database'e kaydet (sadece path, full URL değil)
    await prisma.userAvatar.create({
      data: {
        userId,
        imageUrl: uploadedPath, // Bu zaten path formatında (profile-pictures/...)
        isActive: true,
      },
    });
    
    console.log(`   ✅ Database'e kaydedildi: ${uploadedPath}`);
    
  } catch (error: any) {
    console.error(`   ❌ Hata: ${error.message}`);
    logger.error(`Error uploading avatar for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Tüm avatar'ları yükle
 */
async function uploadAllAvatars(): Promise<void> {
  try {
    console.log('🚀 Avatar yükleme işlemi başlatılıyor...\n');
    
    // MinIO bucket'ını kontrol et
    await s3Service.checkAndCreateBucket();
    console.log('✅ MinIO bucket hazır\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const [fileName, userId, description] of AVATAR_MAPPING) {
      try {
        console.log(`\n👤 ${description} (${userId})`);
        console.log(`   📁 Dosya: ${fileName}`);
        
        await uploadAvatarForUser(fileName, userId, description);
        successCount++;
        
      } catch (error: any) {
        console.error(`   ❌ ${description} için avatar yüklenemedi: ${error.message}`);
        errorCount++;
      }
    }
    
    // Trust User 4 için man-user.jpg kullan (TARGET_USER_ID ile aynı dosya, farklı kullanıcı)
    try {
      console.log(`\n👤 Trust User 4 (${TRUST_USER_IDS[4]})`);
      console.log(`   📁 Dosya: man-user.jpg (TARGET_USER_ID ile aynı dosya)`);
      
      const assetsPath = path.join(__dirname, '../tests/assets/userprofile', 'man-user.jpg');
      if (existsSync(assetsPath)) {
        const fileBuffer = readFileSync(assetsPath);
        const contentType = getContentType(assetsPath);
        const uuid = uuidv4();
        const objectKey = `profile-pictures/${TRUST_USER_IDS[4]}/${uuid}.jpg`;
        
        await s3Service.checkAndCreateBucket();
        const uploadedPath = await s3Service.uploadFile(objectKey, fileBuffer, contentType);
        
        await prisma.userAvatar.updateMany({
          where: {
            userId: TRUST_USER_IDS[4],
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });
        
        await prisma.userAvatar.create({
          data: {
            userId: TRUST_USER_IDS[4],
            imageUrl: uploadedPath,
            isActive: true,
          },
        });
        
        console.log(`   ✅ Avatar yüklendi ve kaydedildi`);
        successCount++;
      }
    } catch (error: any) {
      console.error(`   ❌ Trust User 4 için avatar yüklenemedi: ${error.message}`);
      errorCount++;
    }
    
    console.log('\n📊 Özet:');
    console.log(`   ✅ Başarılı: ${successCount}`);
    console.log(`   ❌ Hata: ${errorCount}`);
    console.log(`   📝 Toplam: ${AVATAR_MAPPING.length + 1}`);
    
  } catch (error) {
    console.error('❌ Genel hata:', error);
    logger.error('Error uploading avatars:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

uploadAllAvatars();

