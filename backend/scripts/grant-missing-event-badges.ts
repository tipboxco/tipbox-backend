import { PrismaClient } from '@prisma/client';
import { BadgeEligibilityService } from '../src/application/gamification/badge-eligibility.service';
import { EventMetricsService } from '../src/application/event/event-metrics.service';

const prisma = new PrismaClient();

async function grantMissingBadges() {
  console.log('\n=== 🏆 Mevcut Kullanıcılara Eksik Badge\'leri Grant Et ===\n');
  
  try {
    const eventId = '00MKFPNIQ30000064YDGL62K7Q';
    
    // Event'te post atmış tüm kullanıcıları bul
    const stats = await prisma.wishboxStats.findMany({
      where: {
        eventId,
        eventPostsCount: { gt: 0 }
      },
      select: {
        userId: true,
        eventPostsCount: true,
        eventLikesReceived: true
      }
    });
    
    console.log(`📊 Toplam ${stats.length} kullanıcı bulundu:\n`);
    
    const metricsService = new EventMetricsService();
    const badgeService = new BadgeEligibilityService();
    
    for (const userStat of stats) {
      const user = await prisma.user.findUnique({
        where: { id: userStat.userId },
        select: { email: true }
      });
      
      console.log(`\n👤 ${user?.email}`);
      console.log(`   Posts: ${userStat.eventPostsCount}, Likes: ${userStat.eventLikesReceived}`);
      
      // Metrics'i al
      const metrics = await metricsService.getUserMetrics(userStat.userId, eventId);
      
      // Badge'leri kontrol et ve grant et
      await badgeService.checkAndGrantEventBadges(userStat.userId, eventId, metrics);
      
      // Kazanılan badge'leri kontrol et
      const userBadges = await prisma.userBadge.findMany({
        where: {
          userId: userStat.userId,
          badge: {
            type: 'EVENT',
            name: { startsWith: '[Event]' }
          }
        },
        include: {
          badge: {
            select: {
              name: true
            }
          }
        }
      });
      
      console.log(`   ✅ Kazanılan badge'ler: ${userBadges.length}`);
      userBadges.forEach(ub => {
        console.log(`      - ${ub.badge.name}`);
      });
    }
    
    console.log('\n\n✅ İşlem tamamlandı!\n');
    
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

grantMissingBadges();
