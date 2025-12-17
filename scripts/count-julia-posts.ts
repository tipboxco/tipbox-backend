import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const julia = await prisma.user.findUnique({
    where: { email: 'julia.havk@tipbox.co' },
    include: {
      profile: true,
    },
  });

  if (!julia) {
    console.log('❌ Julia not found');
    process.exit(1);
  }

  console.log(`✅ Julia kullanıcısı bulundu:`);
  console.log(`   ID: ${julia.id}`);
  console.log(`   Email: ${julia.email}`);
  console.log(`   Name: ${julia.profile?.displayName || 'N/A'}\n`);

  // Tüm post'ları getir
  const allPosts = await prisma.contentPost.findMany({
    where: { userId: julia.id },
    select: {
      id: true,
      type: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Sadece TIPS post'larını getir (detaylı)
  const tipsPosts = await prisma.contentPost.findMany({
    where: { 
      userId: julia.id,
      type: 'TIPS',
    },
    include: {
      tip: true,
      tags: true,
      media: {
        orderBy: { orderIndex: 'asc' },
      },
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Toplam gönderi sayısı: ${allPosts.length}`);
  console.log(`📝 TIPS gönderi sayısı: ${tipsPosts.length}\n`);

  if (tipsPosts.length === 0) {
    console.log('⚠️  Hiç TIPS post bulunamadı!\n');
  } else {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 TIPS POST DETAYLARI:\n`);
    
    tipsPosts.forEach((post, index) => {
      console.log(`\n${index + 1}. ${post.title}`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Tip Kategorisi: ${post.tip?.tipCategory || 'N/A'}`);
      console.log(`   Doğrulanmış: ${post.tip?.isVerified ? '✅' : '❌'}`);
      console.log(`   Ürün: ${post.product?.name || 'N/A'} (${post.product?.brand || 'N/A'})`);
      console.log(`   Oluşturulma: ${post.createdAt.toISOString()}`);
      
      // Tag'ler
      if (post.tags && post.tags.length > 0) {
        const tagNames = post.tags.map(t => t.tag).join(', ');
        console.log(`   Tag'ler: ${tagNames}`);
      }

      // Media
      if (post.media && post.media.length > 0) {
        console.log(`   ✅ Görseller (${post.media.length} adet):`);
        post.media.forEach((media, mediaIndex) => {
          console.log(`      ${mediaIndex + 1}. ${media.mediaUrl} (orderIndex: ${media.orderIndex})`);
        });
      } else {
        console.log(`   ⚠️  Görsel bulunamadı!`);
      }
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n📊 TÜM POST TİPLERİ:`);
  const postsByType = allPosts.reduce((acc, post) => {
    acc[post.type] = (acc[post.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(postsByType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} adet`);
  });

  console.log(`\n✅ Kontrol tamamlandı!`);
  console.log(`📊 Özet:`);
  console.log(`   - Toplam post: ${allPosts.length}`);
  console.log(`   - TIPS post: ${tipsPosts.length}`);
  console.log(`   - Görseli olan TIPS post: ${tipsPosts.filter(p => p.media && p.media.length > 0).length}`);
  console.log(`   - Görseli olmayan TIPS post: ${tipsPosts.filter(p => !p.media || p.media.length === 0).length}`);

  await prisma.$disconnect();
}

main().catch(console.error);

