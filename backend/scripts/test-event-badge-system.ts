/**
 * Event Badge Sistemini test eder
 */

import { PrismaClient } from '@prisma/client';
import { ensureEventBadgeSystem } from '../prisma/seed/helpers/ensure-event-badge-system';
import { ensureMarketplaceBadges } from '../prisma/seed/helpers/ensure-marketplace-badges';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n🎯 Event Badge Sistemi Test Başladı\n');
    
    // 1. Event Badge System
    await ensureEventBadgeSystem(prisma);
    
    // 2. Marketplace Badges
    await ensureMarketplaceBadges(prisma);
    
    // 3. Verification
    console.log('\n📊 Verifying...\n');
    
    const badgeCount = await prisma.badge.count();
    const eventBadgeCount = await prisma.eventBadge.count();
    const eventCount = await prisma.wishboxEvent.count();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SONUÇ:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Badges: ${badgeCount}`);
    console.log(`✅ EventBadges: ${eventBadgeCount}`);
    console.log(`✅ Events: ${eventCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (eventBadgeCount === 0) {
      console.warn('⚠️  EventBadge kayıtları oluşturulamadı!');
    }
    
    if (eventCount === 0) {
      console.warn('⚠️  Test event oluşturulamadı!');
    }
    
    console.log('✅ Test tamamlandı!\n');
    
  } catch (error) {
    console.error('❌ Test başarısız:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
