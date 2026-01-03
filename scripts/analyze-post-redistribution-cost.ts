import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

/**
 * Ömer Faruk'un postlarını diğer kullanıcılara dağıtmanın maliyet analizi
 */
async function analyzePostRedistributionCost() {
  try {
    const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    
    console.log('📊 Post Redistribution Maliyet Analizi\n');
    console.log('='.repeat(80));

    // 1. Ömer Faruk'un post sayısı
    const omerPostCount = await prisma.contentPost.count({
      where: { userId: OMER_USER_ID },
    });

    console.log(`\n1️⃣  Ömer Faruk'un Post Sayısı: ${omerPostCount}`);

    // 2. İlişkili tablolardaki kayıt sayıları
    const postMediaCount = await prisma.postMedia.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const postTagsCount = await prisma.contentPostTag.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const feedEntriesCount = await prisma.feed.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const likesCount = await prisma.contentLike.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const commentsCount = await prisma.contentComment.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const sharesCount = await prisma.contentShare.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    const viewsCount = await prisma.contentPostView.count({
      where: {
        post: {
          userId: OMER_USER_ID,
        },
      },
    });

    console.log(`\n2️⃣  İlişkili Tablo Kayıtları:`);
    console.log(`   - PostMedia: ${postMediaCount} (ortalama ${(postMediaCount / omerPostCount).toFixed(2)} per post)`);
    console.log(`   - PostTags: ${postTagsCount}`);
    console.log(`   - Feed Entries: ${feedEntriesCount}`);
    console.log(`   - Likes: ${likesCount}`);
    console.log(`   - Comments: ${commentsCount}`);
    console.log(`   - Shares: ${sharesCount}`);
    console.log(`   - Views: ${viewsCount}`);

    // 3. Diğer kullanıcı sayısı (postu olan)
    const otherUsers = await prisma.user.findMany({
      where: {
        id: { not: OMER_USER_ID },
        contentPosts: {
          some: {},
        },
      },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true,
          },
        },
        _count: {
          select: {
            contentPosts: true,
          },
        },
      },
    });

    console.log(`\n3️⃣  Dağıtım Hedefi:`);
    console.log(`   - Postu olan diğer kullanıcı sayısı: ${otherUsers.length}`);
    console.log(`   - Her kullanıcıya düşecek post: ~${Math.floor(omerPostCount / otherUsers.length)}`);

    // 4. Maliyet tahmini
    console.log(`\n4️⃣  Maliyet Tahmini (Seed Süresine Eklenecek):\n`);

    // Basit UPDATE yaklaşımı (en hızlı)
    const simpleUpdateTime = (omerPostCount * 2) / 1000; // 2ms per post
    console.log(`   📝 Basit UPDATE Yaklaşımı:`);
    console.log(`      - ContentPost.userId UPDATE: ~${simpleUpdateTime.toFixed(1)} saniye`);
    console.log(`      - PostMedia.userId UPDATE: ~${(postMediaCount * 0.5 / 1000).toFixed(1)} saniye`);
    console.log(`      - Profile.postsCount güncellemeleri: ~${(otherUsers.length * 0.1 / 1000).toFixed(1)} saniye`);
    console.log(`      - Toplam: ~${(simpleUpdateTime + postMediaCount * 0.5 / 1000 + otherUsers.length * 0.1 / 1000).toFixed(1)} saniye`);

    // Batch UPDATE (daha verimli)
    const batchSize = 100;
    const batchCount = Math.ceil(omerPostCount / batchSize);
    const batchUpdateTime = (batchCount * 0.5); // 0.5s per batch
    console.log(`\n   🚀 Batch UPDATE Yaklaşımı (${batchSize} post per batch):`);
    console.log(`      - Batch sayısı: ${batchCount}`);
    console.log(`      - ContentPost UPDATE: ~${batchUpdateTime.toFixed(1)} saniye`);
    console.log(`      - PostMedia UPDATE: ~${(Math.ceil(postMediaCount / batchSize) * 0.3).toFixed(1)} saniye`);
    console.log(`      - Toplam: ~${(batchUpdateTime + Math.ceil(postMediaCount / batchSize) * 0.3).toFixed(1)} saniye`);

    // Feed yeniden dağıtımı (async, seed sonrası)
    console.log(`\n   📡 Feed Yeniden Dağıtımı (Async):`);
    console.log(`      - Feed entries silme: ~${(feedEntriesCount * 0.1 / 1000).toFixed(1)} saniye`);
    console.log(`      - Feed distribution queue job'ları: Async (seed sonrası işlenecek)`);
    console.log(`      - Not: Feed distribution worker tarafından arka planda işlenecek`);

    // Toplam maliyet
    const totalCost = batchUpdateTime + Math.ceil(postMediaCount / batchSize) * 0.3;
    console.log(`\n   ⏱️  TOPLAM SEED SÜRESİNE EKLENECEK: ~${totalCost.toFixed(1)} saniye`);
    console.log(`   💡 Feed distribution async olduğu için seed süresini etkilemez`);

    // 5. Öneriler
    console.log(`\n5️⃣  Öneriler:\n`);
    console.log(`   ✅ Batch UPDATE kullanın (100-500 post per batch)`);
    console.log(`   ✅ Transaction içinde yapın (tutarlılık için)`);
    console.log(`   ✅ Profile.postsCount'u manuel güncelleyin`);
    console.log(`   ✅ Feed'leri silin ve yeniden dağıtım için queue'ya ekleyin`);
    console.log(`   ⚠️  Feed distribution async olduğu için seed sonrası worker çalışmalı`);

    // 6. Örnek dağıtım stratejisi
    console.log(`\n6️⃣  Örnek Dağıtım Stratejisi:\n`);
    const postsPerUser = Math.floor(omerPostCount / otherUsers.length);
    const remainder = omerPostCount % otherUsers.length;
    
    console.log(`   - Her kullanıcıya: ${postsPerUser} post`);
    if (remainder > 0) {
      console.log(`   - İlk ${remainder} kullanıcıya: +1 post (toplam ${postsPerUser + 1})`);
    }
    console.log(`   - Toplam: ${postsPerUser * otherUsers.length + remainder} post dağıtılacak`);

  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePostRedistributionCost();

