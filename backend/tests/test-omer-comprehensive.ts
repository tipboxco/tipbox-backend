import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { InteractionService } from '../src/application/interaction/interaction.service';
import { ContentPostType } from '../src/domain/content/content-post-type.enum';
import { ShareType } from '../src/domain/interaction/share-type.enum';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import SocketManager from '../src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';

const prisma = getPrisma();
const interactionService = new InteractionService();

// Gerçekçi yorum metinleri
const COMMENT_TEXTS = [
  'Harika bir paylaşım! Çok faydalı oldu.',
  'Mükemmel bilgiler, teşekkürler!',
  'Çok güzel bir içerik, beğendim.',
  'Bu konuda daha fazla bilgi paylaşabilir misin?',
  'Harika! Benzer bir deneyimim var.',
  'Çok yararlı, paylaşım için teşekkürler.',
  'Güzel bir paylaşım, devamını bekliyorum.',
  'Çok faydalı bilgiler, not aldım.',
  'Süper bir içerik, paylaştığın için teşekkürler!',
  'Bu bilgiler gerçekten çok değerli.',
  'Harika bir analiz, çok beğendim.',
  'Teşekkürler, çok yardımcı oldu.',
  'Mükemmel bir paylaşım, devam et!',
  'Çok güzel bir içerik, beğendim.',
  'Harika bilgiler, teşekkürler!',
];

// Post başlıkları ve içerikleri
const POST_TEMPLATES = {
  FREE: {
    title: 'Yeni Ürün Deneyimim',
    body: 'Bu ürünü kullanmaya başladım ve gerçekten çok memnunum. Kalitesi ve performansı harika. Sizlerin de denemenizi tavsiye ederim.',
  },
  TIPS: {
    title: 'Kullanım İpuçları',
    body: 'Bu ürünü kullanırken dikkat etmeniz gereken bazı önemli noktalar var. İşte size birkaç ipucu: 1) Düzenli bakım yapın, 2) Doğru şekilde saklayın, 3) Kullanım talimatlarını takip edin.',
  },
  QUESTION: {
    title: 'Bu Ürün Hakkında Soru',
    body: 'Bu ürünü kullanmayı düşünüyorum ama bazı sorularım var. Deneyimi olanlar paylaşabilir mi? Özellikle dayanıklılık ve performans konusunda bilgi almak istiyorum.',
  },
};

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

async function clearAllNotifications() {
  console.log('🧹 Tüm notification\'lar temizleniyor...');
  
  const result = await prisma.notification.deleteMany({});
  
  console.log(`✅ ${result.count} adet notification silindi!\n`);
}

async function findOmerUser() {
  console.log('👤 Ömer kullanıcısı aranıyor...');
  
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
      avatars: {
        where: { isActive: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!omer) {
    throw new Error('Ömer kullanıcısı bulunamadı!');
  }

  console.log(`✅ Ömer bulundu:`);
  console.log(`   ID: ${omer.id}`);
  console.log(`   Email: ${omer.email}`);
  console.log(`   Display Name: ${omer.profile?.displayName || 'N/A'}`);
  console.log(`   Username: ${omer.profile?.userName || 'N/A'}\n`);

  return omer;
}

async function createOrGetTestUser(
  index: number,
  omerId: string
): Promise<any> {
  const email = `testuser${index}@tipbox.co`;
  const displayName = `Test User ${index}`;
  const userName = `testuser${index}`;
  const passwordHash = await bcrypt.hash('test123', 10);

  // Önce mevcut kullanıcıyı kontrol et
  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (user && user.id === omerId) {
    // Eğer Ömer ise, yeni bir ID ile oluştur
    user = null;
  }

  if (!user) {
    // Yeni kullanıcı oluştur
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
        profile: {
          create: {
            displayName,
            userName,
            bio: `Test kullanıcısı ${index} - Bildirim testleri için`,
            bannerUrl: null,
          },
        },
      },
      include: {
        profile: true,
        avatars: true,
      },
    });

    // Avatar oluştur
    await prisma.userAvatar.create({
      data: {
        userId: user.id,
        imageUrl: 'profile-pictures/default/avatar.png',
        isActive: true,
      },
    });

    console.log(`   ✅ Yeni kullanıcı oluşturuldu: ${displayName} (${user.id.substring(0, 8)}...)`);
  } else {
    // Profile yoksa oluştur
    if (!user.profile) {
      await prisma.profile.create({
        data: {
          userId: user.id,
          displayName,
          userName,
          bio: `Test kullanıcısı ${index} - Bildirim testleri için`,
          bannerUrl: null,
        },
      });
    }

    // Avatar yoksa oluştur
    if (!user.avatars || user.avatars.length === 0) {
      await prisma.userAvatar.create({
        data: {
          userId: user.id,
          imageUrl: 'profile-pictures/default/avatar.png',
          isActive: true,
        },
      });
    }

    console.log(`   ✅ Mevcut kullanıcı bulundu: ${user.profile?.displayName || displayName} (${user.id.substring(0, 8)}...)`);
  }

  return user;
}

async function findOrCreateOtherUsers(omerId: string, count: number = 20) {
  console.log(`👥 ${count} adet kullanıcı bulunuyor/oluşturuluyor...`);
  
  // Önce mevcut kullanıcıları bul
  const existingUsers = await prisma.user.findMany({
    where: {
      id: { not: omerId },
      email: { not: null },
      status: 'ACTIVE',
    },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
    take: count,
    orderBy: { createdAt: 'desc' },
  });

  const users: any[] = [...existingUsers];

  // Eğer yeterli kullanıcı yoksa, yeni kullanıcılar oluştur
  if (users.length < count) {
    const needed = count - users.length;
    console.log(`   ⚠️  Sadece ${users.length} kullanıcı bulundu, ${needed} yeni kullanıcı oluşturuluyor...\n`);
    
    for (let i = 0; i < needed; i++) {
      const newUser = await createOrGetTestUser(users.length + i + 1, omerId);
      users.push(newUser);
    }
  }

  // Tüm kullanıcıların profile ve avatar'ı olduğundan emin ol
  for (const user of users) {
    if (!user.profile) {
      await prisma.profile.create({
        data: {
          userId: user.id,
          displayName: user.email?.split('@')[0] || `User ${user.id.substring(0, 8)}`,
          userName: user.email?.split('@')[0] || `user${user.id.substring(0, 8)}`,
          bio: 'Test kullanıcısı',
          bannerUrl: null,
        },
      });
    }

    const activeAvatar = await prisma.userAvatar.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!activeAvatar) {
      await prisma.userAvatar.create({
        data: {
          userId: user.id,
          imageUrl: 'profile-pictures/default/avatar.png',
          isActive: true,
        },
      });
    }
  }

  console.log(`\n✅ Toplam ${users.length} adet kullanıcı hazır:\n`);
  users.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.profile?.displayName || user.email} (${user.id.substring(0, 8)}...)`);
  });
  console.log('');

  return users;
}

async function getOmerExistingPost(omerId: string) {
  console.log('📝 Ömer\'in mevcut postları aranıyor...');
  
  const post = await prisma.contentPost.findFirst({
    where: {
      userId: omerId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!post) {
    console.log('⚠️  Ömer\'in mevcut postu bulunamadı, yeni post oluşturulacak.\n');
    return null;
  }

  console.log(`✅ Mevcut post bulundu:`);
  console.log(`   ID: ${post.id}`);
  console.log(`   Type: ${post.type}`);
  console.log(`   Title: ${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}\n`);

  return post;
}

async function createOmerPost(
  omerId: string,
  type: ContentPostType,
  title: string,
  body: string
) {
  console.log(`📝 ${type} tipinde post oluşturuluyor...`);
  
  // Bir ürün veya kategori bul
  const product = await prisma.product.findFirst({
    select: { id: true, name: true },
  });

  const postId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId: omerId,
      type: type as any,
      title,
      body,
      productId: product?.id || null,
      inventoryRequired: false,
      isBoosted: false,
      commentsCount: 0,
      likesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      favoritesCount: 0,
    },
  });

  // QUESTION tipi için PostQuestion oluştur
  if (type === ContentPostType.QUESTION) {
    await prisma.postQuestion.create({
      data: {
        postId: post.id,
        expectedAnswerFormat: 'SHORT',
      },
    });
  }

  // TIPS tipi için PostTip oluştur
  if (type === ContentPostType.TIPS) {
    await prisma.postTip.create({
      data: {
        postId: post.id,
        tipCategory: 'USAGE',
        isVerified: false,
      },
    });
  }

  console.log(`✅ Post oluşturuldu:`);
  console.log(`   ID: ${post.id}`);
  console.log(`   Type: ${post.type}`);
  console.log(`   Title: ${post.title}\n`);

  return post;
}

async function addInteractionToPost(
  userId: string,
  postId: string,
  type: 'like' | 'comment' | 'favorite' | 'share'
) {
  try {
    switch (type) {
      case 'like':
        await interactionService.likePost(userId, postId);
        break;
      
      case 'comment': {
        const commentText = COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)];
        // InteractionService kullanarak comment oluştur (notification otomatik oluşturulur)
        await interactionService.createComment(userId, postId, commentText);
        break;
      }
      
      case 'favorite':
        await interactionService.favoritePost(userId, postId);
        break;
      
      case 'share':
        await interactionService.sharePost(userId, postId, ShareType.EXTERNAL_SHARE, 'Twitter');
        break;
    }
    
    return true;
  } catch (error: any) {
    // Eğer zaten varsa (duplicate), sessizce geç
    if (error.message?.includes('already') || error.message?.includes('duplicate')) {
      return false;
    }
    throw error;
  }
}

async function addCommentsToPost(
  postId: string,
  users: any[],
  commentCount: number = 5
) {
  console.log(`   💬 Post'a ${commentCount} adet yorum ekleniyor...`);
  
  let successCount = 0;
  let failCount = 0;

  // Rastgele kullanıcılar seç ve comment ekle
  const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
  const usersToComment = shuffledUsers.slice(0, Math.min(commentCount, users.length));

  for (const user of usersToComment) {
    try {
      await addInteractionToPost(user.id, postId, 'comment');
      successCount++;
    } catch (error: any) {
      failCount++;
      // Sessizce devam et
    }
  }

  console.log(`   ✅ ${successCount} yorum eklendi, ${failCount} başarısız\n`);
}

async function addInteractionsToPost(
  postId: string,
  users: any[],
  interactionsPerUser: number = 1
) {
  console.log(`   💬 Post'a etkileşimler ekleniyor (${users.length} kullanıcı, ${interactionsPerUser} etkileşim/kullanıcı)...`);
  
  const interactionTypes: Array<'like' | 'comment' | 'favorite' | 'share'> = ['like', 'comment', 'favorite', 'share'];
  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    // Her kullanıcı için rastgele etkileşimler ekle
    const userInteractions = [];
    for (let i = 0; i < interactionsPerUser; i++) {
      const interactionType = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
      userInteractions.push(interactionType);
    }

    // Duplicate'leri kaldır
    const uniqueInteractions = [...new Set(userInteractions)];

    for (const interactionType of uniqueInteractions) {
      try {
        await addInteractionToPost(user.id, postId, interactionType as 'like' | 'comment' | 'favorite' | 'share');
        successCount++;
      } catch (error: any) {
        failCount++;
        // Sessizce devam et
      }
    }
  }

  console.log(`   ✅ ${successCount} etkileşim eklendi, ${failCount} başarısız\n`);
}

async function main() {
  try {
    await initializeServices();
    
    // 1. Tüm notification'ları temizle
    await clearAllNotifications();
    
    // 2. Ömer kullanıcısını bul
    const omer = await findOmerUser();
    
    // 3. Diğer kullanıcıları bul veya oluştur (20-30 kullanıcı)
    const otherUsers = await findOrCreateOtherUsers(omer.id, 25);
    
    // 4. Ömer'in mevcut bir postunu bul veya oluştur
    let existingPost = await getOmerExistingPost(omer.id);
    
    if (!existingPost) {
      // Mevcut post yoksa, basit bir FREE post oluştur
      const template = POST_TEMPLATES.FREE;
      existingPost = await createOmerPost(omer.id, ContentPostType.FREE, template.title, template.body);
    }
    
    // 5. Mevcut post'a birçok kullanıcı etkileşim ekle
    console.log('='.repeat(60));
    console.log('📌 ADIM 1: Mevcut Post\'a Etkileşimler');
    console.log('='.repeat(60));
    await addCommentsToPost(existingPost.id, otherUsers, 8); // 8 yorum garantili
    await addInteractionsToPost(existingPost.id, otherUsers, 2); // Her kullanıcı 2 etkileşim
    
    // 6. Ömer'in 3 farklı post tipinde gönderisini oluştur
    console.log('='.repeat(60));
    console.log('📌 ADIM 2: Yeni Postlar Oluşturuluyor');
    console.log('='.repeat(60));
    
    const newPosts = [];
    
    // FREE post
    const freeTemplate = POST_TEMPLATES.FREE;
    const freePost = await createOmerPost(
      omer.id,
      ContentPostType.FREE,
      `${freeTemplate.title} - ${new Date().toLocaleDateString('tr-TR')}`,
      freeTemplate.body
    );
    newPosts.push(freePost);
    
    // TIPS post
    const tipsTemplate = POST_TEMPLATES.TIPS;
    const tipsPost = await createOmerPost(
      omer.id,
      ContentPostType.TIPS,
      `${tipsTemplate.title} - ${new Date().toLocaleDateString('tr-TR')}`,
      tipsTemplate.body
    );
    newPosts.push(tipsPost);
    
    // QUESTION post
    const questionTemplate = POST_TEMPLATES.QUESTION;
    const questionPost = await createOmerPost(
      omer.id,
      ContentPostType.QUESTION,
      `${questionTemplate.title} - ${new Date().toLocaleDateString('tr-TR')}`,
      questionTemplate.body
    );
    newPosts.push(questionPost);
    
    // 7. Her yeni post'a birçok kullanıcı etkileşim ekle
    console.log('='.repeat(60));
    console.log('📌 ADIM 3: Yeni Postlara Etkileşimler');
    console.log('='.repeat(60));
    
    for (const post of newPosts) {
      console.log(`\n📝 Post: ${post.type} - ${post.title.substring(0, 40)}...`);
      await addCommentsToPost(post.id, otherUsers, 8); // Her post için 8 yorum garantili
      await addInteractionsToPost(post.id, otherUsers, 2); // Her kullanıcı 2 etkileşim
    }
    
    // 8. Özet
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Tamamlandı!');
    console.log('='.repeat(60));
    console.log(`📊 Özet:`);
    console.log(`   - Ömer ID: ${omer.id}`);
    console.log(`   - Kullanılan kullanıcı sayısı: ${otherUsers.length}`);
    console.log(`   - Mevcut post: ${existingPost.id} (${existingPost.type})`);
    console.log(`   - Yeni postlar:`);
    newPosts.forEach((post, index) => {
      console.log(`     ${index + 1}. ${post.type} - ${post.id}`);
    });
    console.log(`   - Toplam post sayısı: ${1 + newPosts.length}`);
    console.log(`   - Tahmini etkileşim sayısı: ${otherUsers.length * 2 * (1 + newPosts.length)}`);
    console.log('');
    
    // Notification sayısını kontrol et
    const notificationCount = await prisma.notification.count({
      where: { userId: omer.id },
    });
    console.log(`📨 Ömer için oluşturulan notification sayısı: ${notificationCount}`);
    console.log('');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Ömer comprehensive test error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
