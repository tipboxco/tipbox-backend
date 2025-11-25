/**
 * Kullanıcı profil fotoğrafı yükleme scripti
 * Görseli MinIO'ya yükler ve veritabanına kaydeder
 */

// Script için localhost kullan (Docker container dışında çalışıyorsa)
// Environment variable'ı S3Service import edilmeden önce set et
if (!process.env.S3_ENDPOINT) {
  process.env.S3_ENDPOINT = 'http://localhost:9000';
}

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const s3Service = new S3Service();

interface UserCredentials {
  email: string;
  password: string;
}

async function uploadUserAvatar(credentials: UserCredentials, imagePath: string) {
  try {
    console.log('🔍 Kullanıcı aranıyor...');
    console.log(`   Email: ${credentials.email}`);

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new Error(`Kullanıcı bulunamadı: ${credentials.email}`);
    }

    console.log(`✅ Kullanıcı bulundu: ${user.id}`);
    console.log(`   İsim: ${user.profile?.displayName || user.profile?.userName || 'İsimsiz'}`);

    // Görseli oku
    console.log('\n📸 Görsel okunuyor...');
    console.log(`   Dosya: ${imagePath}`);
    
    const imageBuffer = readFileSync(imagePath);
    console.log(`   Boyut: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

    // Dosya uzantısını belirle
    const fileExtension = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Desteklenmeyen dosya formatı: ${fileExtension}`);
    }

    // MIME type belirle
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    const contentType = mimeTypes[fileExtension] || 'image/jpeg';

    // MinIO'ya yükle
    console.log('\n☁️  MinIO\'ya yükleniyor...');
    const fileName = `profile-pictures/${user.id}/${uuidv4()}.${fileExtension}`;
    
    const fileUrl = await s3Service.uploadFile(fileName, imageBuffer, contentType);
    console.log(`✅ Görsel yüklendi: ${fileUrl}`);

    // Veritabanına kaydet
    console.log('\n💾 Veritabanına kaydediliyor...');
    
    // Önceki aktif avatar'ları pasif yap
    await prisma.userAvatar.updateMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Yeni avatar'ı aktif olarak kaydet
    const avatar = await prisma.userAvatar.create({
      data: {
        userId: user.id,
        imageUrl: fileUrl,
        isActive: true,
      },
    });

    console.log(`✅ Avatar kaydedildi: ${avatar.id}`);
    console.log(`   URL: ${fileUrl}`);
    console.log(`   Aktif: ${avatar.isActive ? '✅' : '❌'}`);

    // Kullanıcı profil bilgilerini göster
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        avatars: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        profile: true,
      },
    });

    console.log('\n📋 Güncel Profil Bilgileri:');
    console.log('─'.repeat(80));
    console.log(`   Kullanıcı ID: ${updatedUser?.id}`);
    console.log(`   Email: ${updatedUser?.email}`);
    console.log(`   İsim: ${updatedUser?.profile?.displayName || updatedUser?.profile?.userName || 'İsimsiz'}`);
    if (updatedUser?.avatars && updatedUser.avatars.length > 0) {
      console.log(`   Profil Fotoğrafı: ${updatedUser.avatars[0].imageUrl}`);
    } else {
      console.log(`   Profil Fotoğrafı: Yok`);
    }
    console.log('─'.repeat(80));

    console.log('\n✅ İşlem tamamlandı!');
    console.log(`\n🌐 Frontend erişimi için URL: ${fileUrl}`);
    console.log('   (Aynı ağda olduğunuz için frontend bu URL\'ye erişebilir)');

  } catch (error) {
    console.error('\n❌ Hata:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştırma
const userCredentials: UserCredentials = {
  email: 'omer@tipbox.co',
  password: 'password123',
};

const imagePath = join(__dirname, '../tests/assets/userprofile/ozan.jpg');

console.log('🚀 Kullanıcı profil fotoğrafı yükleme scripti başlatılıyor...\n');
uploadUserAvatar(userCredentials, imagePath);

