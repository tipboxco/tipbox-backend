import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { ContentPostType } from '../src/domain/content/content-post-type.enum';
import { InteractionService } from '../src/application/interaction/interaction.service';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import SocketManager from '../src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = getPrisma();
const interactionService = new InteractionService();
const s3Service = new S3Service();

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

async function findUser(email: string) {
  console.log(`👤 ${email} kullanıcısı aranıyor...`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`${email} kullanıcısı bulunamadı!`);
  }

  console.log(`✅ Kullanıcı bulundu:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Display Name: ${user.profile?.displayName || 'N/A'}`);
  console.log(`   Username: ${user.profile?.userName || 'N/A'}\n`);

  return user;
}

async function uploadImageToS3(imagePath: string, userId: string): Promise<string> {
  console.log(`📤 Görsel S3'e yükleniyor: ${imagePath}`);
  
  try {
    // Dosyayı oku
    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Görsel bulunamadı: ${imagePath}`);
      console.log(`📝 Varsayılan görsel URL'i kullanılıyor...`);
      // Varsayılan görsel URL'i döndür
      return 'post/post.jpg'; // Varsayılan post görseli
    }
    
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    const fileExtension = path.extname(fileName).substring(1) || 'png';
    
    // S3'e yükle
    const s3FileName = `posts/${userId}/${uuidv4()}.${fileExtension}`;
    const imageUrl = await s3Service.uploadFile(s3FileName, fileBuffer, `image/${fileExtension}`);
    
    console.log(`✅ Görsel yüklendi: ${imageUrl}\n`);
    return imageUrl;
  } catch (error: any) {
    console.error(`❌ Görsel yükleme hatası: ${error.message}`);
    console.log(`📝 Varsayılan görsel URL'i kullanılıyor...`);
    // Hata durumunda varsayılan görsel URL'i döndür
    return 'post/post.jpg'; // Varsayılan post görseli
  }
}

async function createIPhonePost(userId: string, imageUrl: string) {
  console.log('📝 iPhone gönderisi oluşturuluyor...');
  
  const postId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId,
      type: ContentPostType.FREE,
      title: 'iPhone 17 - Yeni Özellikler ve Deneyimlerim',
      body: `iPhone 17 ile ilgili deneyimlerimi paylaşmak istiyorum. 

📱 **Tasarım ve Ekran**
Yeni iPhone 17, önceki modellere göre daha ince ve hafif. Ekran kalitesi gerçekten etkileyici - renkler çok canlı ve detaylar net.

⚡ **Performans**
A17 Pro çip ile çok hızlı. Uygulamalar anında açılıyor ve multitasking sorunsuz çalışıyor.

📸 **Kamera**
Kamera sistemi harika! Özellikle gece modu çok başarılı. Portre modunda da çok iyi sonuçlar alıyorum.

🔋 **Batarya**
Günlük kullanımda batarya bir günü rahatlıkla götürüyor. Hızlı şarj özelliği de çok pratik.

Genel olarak çok memnunum. Apple'ın bu modeli gerçekten başarılı olmuş. 🎉`,
      inventoryRequired: false,
      isBoosted: false,
    },
  });

  // PostMedia oluştur
  await prisma.postMedia.create({
    data: {
      postId: post.id,
      userId: userId,
      mediaUrl: imageUrl,
      orderIndex: 0,
    },
  });

  console.log(`✅ Post oluşturuldu:`);
  console.log(`   Post ID: ${post.id}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Type: ${post.type}\n`);

  return post;
}

async function interactWithPost(juliaId: string, postId: string) {
  console.log('💬 Julia ile post etkileşimleri başlatılıyor...\n');

  // 1. Post'u beğen
  console.log('1️⃣  Post beğeniliyor...');
  try {
    const existingLike = await prisma.contentLike.findFirst({
      where: { userId: juliaId, postId },
    });
    if (existingLike) {
      await interactionService.unlikePost(juliaId, postId);
      console.log('   ⚠️  Mevcut beğeni kaldırıldı');
    }
    await interactionService.likePost(juliaId, postId);
    console.log('   ✅ Post beğenildi\n');
  } catch (error: any) {
    console.error(`   ❌ Beğeni hatası: ${error.message}\n`);
  }

  // 2. Yorum yap
  console.log('2️⃣  Yorum yapılıyor...');
  try {
    const commentText = 'Harika bir paylaşım! iPhone 17 gerçekten çok etkileyici görünüyor. Özellikle kamera performansı hakkında daha fazla detay paylaşabilir misin? 📸';
    
    // interactionService.createComment kullan (bildirim göndermek için)
    const comment = await interactionService.createComment(juliaId, postId, commentText);
    
    console.log(`   ✅ Yorum eklendi: "${commentText.substring(0, 50)}..."`);
    console.log(`   Comment ID: ${comment.id}\n`);
  } catch (error: any) {
    console.error(`   ❌ Yorum hatası: ${error.message}\n`);
  }

  // 3. Post'u kaydet (favorite)
  console.log('3️⃣  Post kaydediliyor (favorilere ekleniyor)...');
  try {
    const existingFavorite = await prisma.contentFavorite.findFirst({
      where: { userId: juliaId, postId },
    });
    if (existingFavorite) {
      await interactionService.unfavoritePost(juliaId, postId);
      console.log('   ⚠️  Mevcut favori kaldırıldı');
    }
    await interactionService.favoritePost(juliaId, postId);
    console.log('   ✅ Post favorilere eklendi\n');
  } catch (error: any) {
    console.error(`   ❌ Favori hatası: ${error.message}\n`);
  }
}

async function main() {
  try {
    await initializeServices();

    // 1. Omer kullanıcısını bul
    const omer = await findUser('omer@tipbox.co');

    // 2. Görseli S3'e yükle
    const imagePath = path.join(__dirname, 'assets/Apple_Products/apple-product-iphone17.png');
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Görsel bulunamadı: ${imagePath}`);
    }
    const imageUrl = await uploadImageToS3(imagePath, omer.id);

    // 3. iPhone postu oluştur
    const post = await createIPhonePost(omer.id, imageUrl);

    // 4. Julia kullanıcısını bul
    const julia = await findUser('julia.havk@tipbox.co');

    // 5. Julia ile etkileşimler
    await interactWithPost(julia.id, post.id);

    console.log('='.repeat(60));
    console.log('✅ Tüm işlemler tamamlandı!');
    console.log('='.repeat(60));
    console.log(`📊 Özet:`);
    console.log(`   - Post ID: ${post.id}`);
    console.log(`   - Post Sahibi: ${omer.profile?.displayName || omer.email}`);
    console.log(`   - Etkileşim Yapan: ${julia.profile?.displayName || julia.email}`);
    console.log(`   - Yapılan İşlemler:`);
    console.log(`     1. ✅ Post beğenildi`);
    console.log(`     2. ✅ Yorum yapıldı`);
    console.log(`     3. ✅ Post favorilere eklendi`);
    console.log('');

    // 6. Bildirimleri kontrol et (queue işlenmesi için bekle)
    console.log('⏳ Bildirimlerin işlenmesi bekleniyor (5 saniye)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('📬 Bildirimler kontrol ediliyor...\n');
    const notifications = await prisma.notification.findMany({
      where: {
        userId: omer.id,
        type: {
          in: ['POST_LIKED', 'POST_COMMENTED', 'POST_FAVORITED'] as any[],
        },
        createdAt: {
          gte: new Date(Date.now() - 60000), // Son 1 dakika
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    if (notifications.length > 0) {
      console.log(`✅ ${notifications.length} bildirim bulundu:\n`);
      for (const notif of notifications) {
        const data = notif.data as any;
        console.log(`📌 ${notif.type}:`);
        console.log(`   - ID: ${notif.id}`);
        console.log(`   - Post ID: ${data?.postId || 'N/A'}`);
        if (notif.type === 'POST_COMMENTED') {
          console.log(`   - Description: ${data?.description || '❌ EKSİK!'}`);
          console.log(`   - Comment ID: ${data?.commentId || 'N/A'}`);
          if (data?.commenterName) {
            console.log(`   - ⚠️  Commenter Name hala data'da: ${data.commenterName} (kaldırılmalı)`);
          }
          if (data?.commenterId) {
            console.log(`   - ⚠️  Commenter ID hala data'da: ${data.commenterId} (kaldırılmalı)`);
          }
        }
        if (data?.postContent) {
          console.log(`   - Post Content: ${(data.postContent as string).substring(0, 50)}...`);
        }
        if (data?.postType) {
          console.log(`   - Post Type: ${data.postType}`);
        }
        console.log('');
      }
    } else {
      console.log('⚠️  Henüz bildirim oluşturulmamış (queue işleniyor olabilir)');
    }

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('iPhone post creation error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
