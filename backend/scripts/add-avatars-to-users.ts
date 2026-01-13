import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Config } from '../src/infrastructure/config/s3.config';
import logger from '../src/infrastructure/logger/logger';
import { buildMediaUrl } from '../src/infrastructure/config/media.config';

const prisma = new PrismaClient();
const s3Service = new S3Service();

/**
 * MinIO'da mevcut avatar görsellerini listeler
 */
async function listAvailableAvatars(): Promise<string[]> {
  try {
    const avatars: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: s3Config.bucketName,
        Prefix: 'profile-pictures/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Service['s3Client'].send(listCommand);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && (obj.Key.endsWith('.jpg') || obj.Key.endsWith('.jpeg') || obj.Key.endsWith('.png'))) {
            avatars.push(obj.Key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return avatars;
  } catch (error) {
    logger.error('Error listing avatars from MinIO:', error);
    return [];
  }
}

/**
 * Tüm kullanıcıları bulup avatar durumlarını kontrol eder
 */
async function addAvatarsToUsers() {
  try {
    console.log('🔍 MinIO\'da mevcut avatar görselleri aranıyor...');
    const availableAvatars = await listAvailableAvatars();
    
    if (availableAvatars.length === 0) {
      console.log('❌ MinIO\'da avatar görseli bulunamadı!');
      console.log('💡 Önce avatar görsellerini MinIO\'ya yükleyin (profile-pictures/ klasörüne)');
      return;
    }

    console.log(`✅ ${availableAvatars.length} adet avatar görseli bulundu\n`);

    // Avatar görsellerini göster
    console.log('📋 Mevcut avatar görselleri:');
    availableAvatars.slice(0, 10).forEach((avatar, index) => {
      console.log(`   ${index + 1}. ${avatar}`);
    });
    if (availableAvatars.length > 10) {
      console.log(`   ... ve ${availableAvatars.length - 10} adet daha\n`);
    } else {
      console.log('');
    }

    console.log('👥 Tüm kullanıcılar kontrol ediliyor...');
    
    // Tüm kullanıcıları al
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        avatars: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    console.log(`✅ ${users.length} adet kullanıcı bulundu\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Avatar görsellerini döngüde kullanmak için index
    let avatarIndex = 0;

    for (const user of users) {
      try {
        // Kullanıcının aktif avatar'ı var mı kontrol et
        const hasActiveAvatar = user.avatars && user.avatars.length > 0;
        let currentAvatar = hasActiveAvatar ? user.avatars[0] : null;

        // Kullanıcı ID'sine göre MinIO'da avatar var mı kontrol et
        const userAvatarPath = `profile-pictures/${user.id}/`;
        const userSpecificAvatar = availableAvatars.find(avatar => 
          avatar.startsWith(userAvatarPath)
        );

        // Eğer kullanıcıya özel avatar varsa onu kullan, yoksa genel bir avatar seç
        let selectedAvatar: string;
        if (userSpecificAvatar) {
          selectedAvatar = userSpecificAvatar;
          console.log(`\n👤 ${user.email} (${user.profile?.displayName || 'N/A'})`);
          console.log(`   ✅ Kullanıcıya özel avatar bulundu: ${selectedAvatar}`);
        } else if (!hasActiveAvatar) {
          // Avatar görseli seç (döngüsel olarak)
          selectedAvatar = availableAvatars[avatarIndex % availableAvatars.length];
          avatarIndex++;
          console.log(`\n👤 ${user.email} (${user.profile?.displayName || 'N/A'})`);
          console.log(`   Avatar: ${selectedAvatar}`);
        } else {
          // Avatar'ı var ama MinIO path'ini kontrol et ve güncelle
          const currentUrl = currentAvatar!.imageUrl;
          const isMinIOPath = currentUrl.includes('profile-pictures/') || 
                              currentUrl.includes('tipbox-media/');
          
          if (!isMinIOPath) {
            // Geçersiz path, MinIO'dan avatar seç
            selectedAvatar = availableAvatars[avatarIndex % availableAvatars.length];
            avatarIndex++;
            console.log(`\n👤 ${user.email} (${user.profile?.displayName || 'N/A'})`);
            console.log(`   ⚠️  Mevcut avatar geçersiz path: ${currentUrl}`);
            console.log(`   Avatar: ${selectedAvatar}`);
          } else {
            // Avatar'ı var ve geçerli MinIO path'inde, atla
            console.log(`⏭️  ${user.email} - Avatar'ı var ve geçerli MinIO path'inde, atlanıyor`);
            skippedCount++;
            continue;
          }
        }

        // Avatar URL'ini oluştur
        const avatarUrl = buildMediaUrl(selectedAvatar);

        // Eğer mevcut avatar varsa ve farklıysa, önce eski avatar'ı pasif yap
        if (currentAvatar) {
          const currentUrl = currentAvatar.imageUrl;
          // Eğer URL farklıysa güncelle
          if (currentUrl !== avatarUrl) {
            await prisma.userAvatar.update({
              where: { id: currentAvatar.id },
              data: { isActive: false },
            });
            console.log(`   🔄 Eski avatar pasif yapıldı`);
          } else {
            console.log(`   ⏭️  Avatar zaten doğru path'te, atlanıyor`);
            skippedCount++;
            continue;
          }
        }

        console.log(`   URL: ${avatarUrl}`);

        // UserAvatar kaydı oluştur
        await prisma.userAvatar.create({
          data: {
            userId: user.id,
            imageUrl: avatarUrl,
            isActive: true,
          },
        });

        console.log(`   ✅ Avatar ${hasActiveAvatar ? 'güncellendi' : 'eklendi'}!`);
        updatedCount++;
      } catch (error: any) {
        console.error(`   ❌ Hata: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Güncellenen: ${updatedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);
    console.log(`   ❌ Hata: ${errorCount}`);
    console.log(`   📝 Toplam: ${users.length}`);

  } catch (error) {
    console.error('❌ Genel hata:', error);
    logger.error('Error adding avatars to users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addAvatarsToUsers();

