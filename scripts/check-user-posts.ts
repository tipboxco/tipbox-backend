import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function checkUserPosts() {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        _count: {
          select: {
            contentPosts: true,
          },
        },
      },
      orderBy: {
        contentPosts: {
          _count: 'desc',
        },
      },
    });

    console.log('📊 Kullanıcı Post Sayıları:\n');
    console.log('='.repeat(80));

    users.forEach((user, index) => {
      const userName = user.profile?.displayName || user.profile?.userName || user.email || user.id.substring(0, 8) + '...';
      const displayName = userName.length > 40 ? userName.substring(0, 37) + '...' : userName;
      console.log(`${(index + 1).toString().padStart(3, ' ')}. ${displayName.padEnd(40, ' ')} | Post: ${user._count.contentPosts.toString().padStart(4, ' ')}`);
    });

    console.log('='.repeat(80));
    console.log(`\n📝 Toplam Kullanıcı: ${users.length}`);
    
    const totalPosts = users.reduce((sum, u) => sum + u._count.contentPosts, 0);
    console.log(`📝 Toplam Post: ${totalPosts}`);
    
    const usersWithPosts = users.filter(u => u._count.contentPosts > 0).length;
    const usersWithoutPosts = users.length - usersWithPosts;
    console.log(`📝 Postu Olan Kullanıcı: ${usersWithPosts}`);
    console.log(`📝 Postu Olmayan Kullanıcı: ${usersWithoutPosts}`);

    // En çok postu olan kullanıcılar
    const topUsers = users.filter(u => u._count.contentPosts > 0).slice(0, 10);
    if (topUsers.length > 0) {
      console.log('\n🏆 En Çok Postu Olan 10 Kullanıcı:');
      topUsers.forEach((user, index) => {
        const userName = user.profile?.displayName || user.profile?.userName || user.email || user.id.substring(0, 8) + '...';
        const displayName = userName.length > 40 ? userName.substring(0, 37) + '...' : userName;
        console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${displayName.padEnd(40, ' ')} - ${user._count.contentPosts} post`);
      });
    }

  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPosts();

