/**
 * Veritabanındaki tüm kullanıcıları listele
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

async function listUsers() {
  try {
    const prisma = getPrisma();
    
    console.log('📋 Veritabanındaki kullanıcılar:\n');
    console.log('='.repeat(80));
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            userName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (users.length === 0) {
      console.log('❌ Veritabanında kullanıcı bulunamadı.\n');
      return;
    }

    console.log(`\nToplam ${users.length} kullanıcı bulundu:\n`);
    
    users.forEach((user, index) => {
      const displayName = user.profile?.displayName || 'İsimsiz';
      const userName = user.profile?.userName || '-';
      console.log(`${index + 1}. ${displayName}`);
      console.log(`   Username: ${userName}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email || '-'}`);
      console.log(`   Oluşturulma: ${user.createdAt.toISOString()}`);
      console.log(`   Güncellenme: ${user.updatedAt.toISOString()}`);
      console.log('');
    });

    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    const prisma = getPrisma();
    await prisma.$disconnect();
  }
}

// Script çalıştır
listUsers();
