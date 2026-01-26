import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../src/infrastructure/logger/logger';
import { resolveMediaUrl } from '../src/infrastructure/config/media.config';

const prisma = getPrisma();
const s3Service = new S3Service();

/**
 * Omer kullanıcısının avatarını default avatar ile güncelle
 */
async function updateOmerAvatar(): Promise<void> {
  try {
    console.log('🚀 Omer kullanıcısının avatarını güncelleme işlemi başlatılıyor...\n');
    
    // Omer kullanıcısını bul (email veya userName ile)
    const omerUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'omer@tipbox.co' },
          { email: { contains: 'omer', mode: 'insensitive' } },
        ],
      },
      include: {
        profile: true,
      },
    });

    if (!omerUser) {
      throw new Error('Omer kullanıcısı bulunamadı!');
    }

    console.log(`✅ Kullanıcı bulundu:`);
    console.log(`   ID: ${omerUser.id}`);
    console.log(`   Email: ${omerUser.email}`);
    console.log(`   Profile: ${omerUser.profile ? 'Var' : 'Yok'}\n`);

    // Default avatar dosyasının yolu
    const defaultAvatarFilePath = path.join(
      __dirname,
      '../tests/assets/defaultavatar/default-useravatar.png'
    );

    if (!existsSync(defaultAvatarFilePath)) {
      throw new Error(`Default avatar dosyası bulunamadı: ${defaultAvatarFilePath}`);
    }

    console.log(`📁 Avatar dosyası: ${defaultAvatarFilePath}`);

    // Dosyayı oku
    const fileBuffer = readFileSync(defaultAvatarFilePath);
    const contentType = 'image/png';
    const fileExt = 'png';
    console.log(`📦 Dosya boyutu: ${(fileBuffer.length / 1024).toFixed(2)} KB\n`);

    // MinIO bucket'ını kontrol et
    await s3Service.checkAndCreateBucket();
    console.log('✅ MinIO bucket hazır\n');

    // MinIO'ya yükleme path'i oluştur
    const uuid = uuidv4();
    const objectKey = `profile-pictures/${omerUser.id}/${uuid}.${fileExt}`;

    console.log(`📤 MinIO'ya yükleniyor: ${objectKey}`);

    // MinIO'ya yükle
    const uploadedPath = await s3Service.uploadFile(objectKey, fileBuffer, contentType);

    console.log(`✅ MinIO'ya yüklendi: ${uploadedPath}`);

    // Database'de mevcut aktif avatar'ı pasif yap
    const deactivatedCount = await prisma.userAvatar.updateMany({
      where: {
        userId: omerUser.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`\n📝 Önceki aktif avatar'lar pasif yapıldı: ${deactivatedCount.count} adet`);

    // Yeni avatar'ı database'e kaydet (sadece path, full URL değil)
    const newAvatar = await prisma.userAvatar.create({
      data: {
        userId: omerUser.id,
        imageUrl: uploadedPath, // Bu zaten path formatında (profile-pictures/...)
        isActive: true,
      },
    });

    console.log(`✅ Database'e kaydedildi:`);
    console.log(`   Avatar ID: ${newAvatar.id}`);
    console.log(`   Image URL (path): ${newAvatar.imageUrl}`);
    console.log(`   Is Active: ${newAvatar.isActive}`);

    // Tam URL'yi oluştur
    const avatarUrl = resolveMediaUrl(uploadedPath, false);
    console.log(`   Full URL: ${avatarUrl}\n`);

    // Veritabanından kontrol et
    console.log('🔍 Veritabanı kontrolü:');
    const activeAvatar = await prisma.userAvatar.findFirst({
      where: {
        userId: omerUser.id,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeAvatar) {
      console.log(`✅ Aktif avatar bulundu:`);
      console.log(`   ID: ${activeAvatar.id}`);
      console.log(`   Image URL: ${activeAvatar.imageUrl}`);
      console.log(`   Created At: ${activeAvatar.createdAt}`);
      console.log(`   Is Active: ${activeAvatar.isActive}`);
    } else {
      console.log(`⚠️  Aktif avatar bulunamadı!`);
    }

    // Profil bilgilerini kontrol et
    console.log('\n📋 Profil bilgileri:');
    const profile = await prisma.profile.findUnique({
      where: { userId: omerUser.id },
    });

    if (profile) {
      console.log(`   Display Name: ${profile.displayName}`);
      console.log(`   User Name: ${profile.userName}`);
      console.log(`   Banner URL: ${profile.bannerUrl || 'Yok'}`);
    }

    // Backend response'unu simüle et (GET /users/:userId/profile gibi)
    console.log('\n📡 Backend Response (Simüle):');
    const responseData = {
      id: omerUser.id,
      name: profile?.displayName || omerUser.email || 'Anonymous User',
      avatar: resolveMediaUrl(activeAvatar?.imageUrl ?? null, true),
      bannerUrl: resolveMediaUrl(profile?.bannerUrl ?? null, false),
      biography: profile?.bio ?? null,
    };

    console.log(JSON.stringify(responseData, null, 2));

    console.log('\n🎉 Avatar güncelleme işlemi tamamlandı!');

  } catch (error: any) {
    console.error(`\n❌ Hata: ${error.message}`);
    logger.error('Error updating omer avatar:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateOmerAvatar();
