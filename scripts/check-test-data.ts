/**
 * Veritabanındaki thread'leri ve kullanıcıları kontrol eder
 * Socket testi için gerçek verileri gösterir
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestData() {
  try {
    console.log('🔍 Veritabanı kontrol ediliyor...\n');

    // Kullanıcıları listele
    const users = await prisma.user.findMany({
      take: 10,
      include: {
        profile: {
          select: {
            displayName: true,
            userName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('📋 Kullanıcılar (İlk 10):');
    console.log('─'.repeat(80));
    users.forEach((user, index) => {
      const name = user.profile?.displayName || user.profile?.userName || user.email || 'İsimsiz';
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   İsim: ${name}`);
      console.log(`   Email: ${user.email || 'Yok'}`);
      console.log('');
    });

    // Thread'leri listele
    const threads = await prisma.dMThread.findMany({
      take: 10,
      include: {
        userOne: {
          include: {
            profile: {
              select: {
                displayName: true,
                userName: true,
              },
            },
          },
        },
        userTwo: {
          include: {
            profile: {
              select: {
                displayName: true,
                userName: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: {
            sentAt: 'desc',
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log('\n💬 Threadler (Ilk 10):');
    console.log('─'.repeat(80));
    
    if (threads.length === 0) {
      console.log('❌ Veritabanında thread bulunamadı!');
      console.log('\n💡 Thread oluşturmak için:');
      console.log('   POST /messages endpoint\'ini kullanarak mesaj gönderin');
      console.log('   Örnek: curl -X POST http://localhost:3000/messages \\');
      console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"recipientId": "USER_ID", "message": "Test mesajı"}\'');
    } else {
      threads.forEach((thread, index) => {
        const userOneName = thread.userOne.profile?.displayName || 
                           thread.userOne.profile?.userName || 
                           thread.userOne.email || 
                           'İsimsiz';
        const userTwoName = thread.userTwo.profile?.displayName || 
                           thread.userTwo.profile?.userName || 
                           thread.userTwo.email || 
                           'İsimsiz';
        const lastMessage = thread.messages[0];
        
        console.log(`${index + 1}. Thread ID: ${thread.id}`);
        console.log(`   Kullanıcı 1: ${userOneName} (${thread.userOneId})`);
        console.log(`   Kullanıcı 2: ${userTwoName} (${thread.userTwoId})`);
        console.log(`   Mesaj Sayısı: ${thread._count.messages}`);
        console.log(`   Aktif: ${thread.isActive ? '✅' : '❌'}`);
        if (lastMessage) {
          console.log(`   Son Mesaj: ${lastMessage.message.substring(0, 50)}${lastMessage.message.length > 50 ? '...' : ''}`);
          console.log(`   Son Mesaj Tarihi: ${lastMessage.sentAt.toISOString()}`);
        }
        console.log(`   Oluşturulma: ${thread.createdAt.toISOString()}`);
        console.log('');
      });
    }

    // Mesaj sayısını göster
    const messageCount = await prisma.dMMessage.count();
    console.log(`\n📊 Toplam Mesaj Sayısı: ${messageCount}`);

    // Test için öneriler
    console.log('\n🧪 Socket Testi İçin:');
    console.log('─'.repeat(80));
    
    if (threads.length > 0) {
      const firstThread = threads[0];
      console.log(`1. Thread ID: ${firstThread.id}`);
      console.log(`   - Kullanıcı 1 ID: ${firstThread.userOneId}`);
      console.log(`   - Kullanıcı 2 ID: ${firstThread.userTwoId}`);
      console.log('\n2. Bu thread\'i test etmek için:');
      console.log(`   - test-socket.html sayfasında Thread ID: ${firstThread.id} girin`);
      console.log(`   - Her iki kullanıcının JWT token'ları ile bağlanın`);
      console.log(`   - join_thread event'i ile thread'e katılın`);
      console.log(`   - Mesaj gönderin ve event'leri izleyin`);
    } else {
      console.log('1. Önce bir thread oluşturun (mesaj göndererek)');
      console.log('2. Oluşturulan thread ID\'sini test-socket.html\'de kullanın');
    }

  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData();

