import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { InteractionService } from '../src/application/interaction/interaction.service';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import SocketManager from '../src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';

const prisma = getPrisma();
const interactionService = new InteractionService();

async function initializeServices() {
  try {
    console.log('🔧 Servisler başlatılıyor...');
    await RedisConfigManager.getInstance().initialize();
    await QueueProvider.getInstance().initialize();
    
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],
    });
    SocketManager.getInstance().initialize(io);
    
    console.log('✅ Servisler başlatıldı!\n');
  } catch (error: any) {
    console.log(`⚠️  Servis uyarısı: ${error.message}\n`);
  }
}

async function findOmerUser() {
  console.log('👤 Omer kullanıcısı aranıyor...');
  
  const omer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'omer', mode: 'insensitive' } },
        { email: 'omer@tipbox.co' },
        { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
        { profile: { userName: { contains: 'omer', mode: 'insensitive' } } },
      ],
    },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
    },
  });

  if (!omer) {
    throw new Error('Omer kullanıcısı bulunamadı!');
  }

  console.log(`✅ Omer bulundu:`);
  console.log(`   ID: ${omer.id}`);
  console.log(`   Email: ${omer.email}`);
  console.log(`   Display Name: ${omer.profile?.displayName || 'N/A'}`);
  console.log(`   Username: ${omer.profile?.userName || 'N/A'}\n`);

  return omer;
}

async function findOmerPosts(omerId: string, count: number = 3) {
  console.log(`📝 Omer'in ${count} postu aranıyor...`);
  
  const posts = await prisma.contentPost.findMany({
    where: {
      userId: omerId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: count,
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      createdAt: true,
    },
  });

  if (posts.length < count) {
    console.log(`⚠️  Sadece ${posts.length} post bulundu, ${count} post gerekiyor.`);
    console.log(`   Mevcut postlar kullanılacak.\n`);
  } else {
    console.log(`✅ ${posts.length} post bulundu:\n`);
    posts.forEach((post, index) => {
      console.log(`   ${index + 1}. Post ID: ${post.id}`);
      console.log(`      Title: ${post.title || 'Başlık yok'}`);
      console.log(`      Type: ${post.type}`);
      console.log(`      Created: ${post.createdAt.toISOString()}\n`);
    });
  }

  return posts;
}

async function findRealUsers(excludeUserId: string, count: number = 3) {
  console.log(`👥 ${count} gerçek kullanıcı aranıyor...`);
  
  // Önce bilinen kullanıcıları bul (julia, trust user vb.)
  const knownEmails = [
    'julia.havk@tipbox.co',
    'trust.user1@tipbox.co',
    'trust.user2@tipbox.co',
    'trust.user3@tipbox.co',
    'test.user1@tipbox.co',
    'test.user2@tipbox.co',
  ];

  const knownUsers = await prisma.user.findMany({
    where: {
      email: { in: knownEmails },
      id: { not: excludeUserId },
    },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
    },
    take: count,
  });

  // Eğer yeterli kullanıcı bulunamadıysa, rastgele kullanıcılar al
  let users = knownUsers;
  if (users.length < count) {
    const additionalUsers = await prisma.user.findMany({
      where: {
        id: { 
          notIn: [excludeUserId, ...users.map(u => u.id)],
        },
      },
      include: {
        profile: {
          select: {
            displayName: true,
            userName: true,
          },
        },
      },
      take: count - users.length,
    });
    users = [...users, ...additionalUsers];
  }

  if (users.length === 0) {
    throw new Error('Kullanıcı bulunamadı!');
  }

  console.log(`✅ ${users.length} kullanıcı bulundu:\n`);
  users.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.profile?.displayName || user.email}`);
    console.log(`      Email: ${user.email}`);
    console.log(`      ID: ${user.id}\n`);
  });

  return users.slice(0, count);
}

async function likePost(userId: string, postId: string, userName: string) {
  try {
    // Önce mevcut beğeniyi kontrol et
    const existingLike = await prisma.contentLike.findFirst({
      where: {
        userId,
        postId,
      },
    });

    if (existingLike) {
      // Mevcut beğeniyi kaldır
      await interactionService.unlikePost(userId, postId);
      console.log(`   ⚠️  Mevcut beğeni kaldırıldı`);
    }

    // Yeni beğeni oluştur
    await interactionService.likePost(userId, postId);
    console.log(`   ✅ ${userName} post'u beğendi`);
  } catch (error: any) {
    console.error(`   ❌ Beğeni hatası: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    await initializeServices();

    // 1. Omer kullanıcısını bul
    const omer = await findOmerUser();

    // 2. Omer'in 3 postunu bul
    const posts = await findOmerPosts(omer.id, 3);
    
    if (posts.length === 0) {
      throw new Error('Omer\'in hiç postu yok!');
    }

    // 3. 3 farklı gerçek kullanıcı bul
    const users = await findRealUsers(omer.id, 3);

    // 4. Her kullanıcıya 3 post'a beğeni at
    console.log('❤️  Beğeniler atılıyor...\n');
    
    let totalLikes = 0;
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userName = user.profile?.displayName || user.email;
      
      console.log(`${i + 1}. ${userName} beğenileri:`);
      
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j];
        console.log(`   Post ${j + 1} (${post.id.substring(0, 20)}...):`);
        await likePost(user.id, post.id, userName);
        totalLikes++;
        
        // Kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✅ Tüm işlemler tamamlandı!');
    console.log('='.repeat(60));
    console.log(`📊 Özet:`);
    console.log(`   - Post Sahibi: ${omer.profile?.displayName || omer.email}`);
    console.log(`   - Post Sayısı: ${posts.length}`);
    console.log(`   - Kullanıcı Sayısı: ${users.length}`);
    console.log(`   - Toplam Beğeni: ${totalLikes}`);
    console.log('');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
