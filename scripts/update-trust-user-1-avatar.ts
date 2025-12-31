/**
 * Trust User 1'in profil fotoğrafını useravatar3.jpg olarak günceller
 * 
 * Kullanım:
 *   - Docker container içinde: docker-compose exec backend npx ts-node scripts/update-trust-user-1-avatar.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// DATABASE_URL kontrolü
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL bulunamadı!');
  console.error('   Docker container içinde çalıştırmak için:');
  console.error('   docker-compose exec backend npx ts-node scripts/update-trust-user-1-avatar.ts');
  process.exit(1);
}

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Trust User 1 ID
const TRUST_USER_1_ID = '22222222-2222-4222-a222-222222222222';

async function updateTrustUser1Avatar(): Promise<void> {
  console.log('🔄 Trust User 1 profil fotoğrafı güncelleniyor...\n');

  try {
    // 1. Kullanıcıyı kontrol et
    const user = await prisma.user.findUnique({
      where: { id: TRUST_USER_1_ID },
    });

    if (!user) {
      console.error(`❌ Trust User 1 bulunamadı (ID: ${TRUST_USER_1_ID})`);
      process.exit(1);
    }

    console.log(`✅ Kullanıcı bulundu: ${user.email}`);

    // 2. Avatar dosyasını oku
    const avatarPath = path.join(__dirname, '../tests/assets/userprofile/useravatar3.jpg');
    
    let avatarBuffer: Buffer;
    try {
      avatarBuffer = readFileSync(avatarPath);
      console.log(`✅ Avatar dosyası okundu: ${avatarPath}`);
    } catch (error) {
      console.error(`❌ Avatar dosyası okunamadı: ${avatarPath}`);
      console.error(`   Hata: ${error}`);
      process.exit(1);
    }

    // 3. MinIO bucket'ını kontrol et/oluştur
    await s3Service.checkAndCreateBucket();
    console.log('✅ MinIO bucket hazır');

    // 4. Avatar'ı MinIO'ya yükle
    // Format: profile-pictures/{userId}/useravatar3.jpg
    const avatarObjectKey = `profile-pictures/${TRUST_USER_1_ID}/useravatar3.jpg`;
    
    let avatarUrl: string;
    try {
      avatarUrl = await s3Service.uploadFile(avatarObjectKey, avatarBuffer, 'image/jpeg');
      console.log(`✅ Avatar MinIO'ya yüklendi: ${avatarUrl}`);
    } catch (error) {
      console.error(`❌ Avatar MinIO'ya yüklenemedi`);
      console.error(`   Hata: ${error}`);
      process.exit(1);
    }

    // 5. Mevcut avatar'ları pasif yap
    await prisma.userAvatar.updateMany({
      where: { userId: TRUST_USER_1_ID },
      data: { isActive: false },
    });
    console.log('✅ Eski avatar\'lar pasif yapıldı');

    // 6. Yeni avatar'ı oluştur veya güncelle
    const existingAvatar = await prisma.userAvatar.findFirst({
      where: { userId: TRUST_USER_1_ID, imageUrl: avatarUrl },
    });

    if (existingAvatar) {
      // Mevcut avatar'ı aktif yap
      await prisma.userAvatar.update({
        where: { id: existingAvatar.id },
        data: { isActive: true },
      });
      console.log('✅ Mevcut avatar aktif yapıldı');
    } else {
      // Yeni avatar oluştur
      await prisma.userAvatar.create({
        data: {
          userId: TRUST_USER_1_ID,
          imageUrl: avatarUrl,
          isActive: true,
        },
      });
      console.log('✅ Yeni avatar oluşturuldu');
    }

    console.log('\n✅ Trust User 1 profil fotoğrafı başarıyla güncellendi!');
    console.log(`   Avatar URL: ${avatarUrl}`);

  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

async function main() {
  try {
    await updateTrustUser1Avatar();
  } catch (error) {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


