import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { UserService } from '../src/application/user/user.service';
import { resolveMediaUrl } from '../src/infrastructure/config/media.config';

const prisma = getPrisma();
const userService = new UserService();
const userId = '480f5de9-b691-4d70-a6a8-2789226f4e07';

/**
 * Omer kullanıcısının avatar response'unu test et
 */
async function testOmerAvatarResponse(): Promise<void> {
  try {
    console.log('🔍 Backend Response Testi\n');
    console.log('User ID:', userId);
    console.log('='.repeat(60) + '\n');

    // 1. getUserProfileCard endpoint response'unu simüle et
    console.log('1️⃣ getUserProfileCard Response:');
    const profileCard = await userService.getUserProfileCard(userId);
    if (profileCard) {
      console.log(JSON.stringify(profileCard, null, 2));
    } else {
      console.log('❌ Profil kartı bulunamadı!');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. getUserProfileForViewer endpoint response'unu simüle et (kendi kendini görüntüleme)
    console.log('2️⃣ getUserProfileForViewer Response (self view):');
    const profileForViewer = await userService.getUserProfileForViewer(userId, userId);
    if (profileForViewer) {
      console.log(JSON.stringify(profileForViewer, null, 2));
    } else {
      console.log('❌ Profil bulunamadı!');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. Veritabanından direkt kontrol
    console.log('3️⃣ Veritabanından Direkt Kontrol:');
    const activeAvatar = await prisma.userAvatar.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (activeAvatar) {
      console.log('✅ Aktif Avatar:');
      console.log('   Path:', activeAvatar.imageUrl);
      console.log('   Full URL:', resolveMediaUrl(activeAvatar.imageUrl, false));
      console.log('   Fallback URL (default avatar):', resolveMediaUrl(activeAvatar.imageUrl, true));
    } else {
      console.log('❌ Aktif avatar bulunamadı!');
    }

    if (profile) {
      console.log('\n✅ Profil:');
      console.log('   Display Name:', profile.displayName);
      console.log('   User Name:', profile.userName);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test tamamlandı!');

  } catch (error: any) {
    console.error(`\n❌ Hata: ${error.message}`);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testOmerAvatarResponse();
