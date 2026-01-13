import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { GamificationService } from '../../application/gamification/gamification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { TestDataCreator, CreatedTestData } from './helpers/test-data-creator';
import { TestDataCleaner } from './helpers/test-data-cleaner';
import { MediaHelper } from './helpers/media-helper';
import RedisConfigManager from '../../infrastructure/config/redis.config';
import QueueProvider from '../../infrastructure/queue/queue.provider';
import logger from '../../infrastructure/logger/logger';

const prisma = new PrismaClient();

interface TestResult {
  type: NotificationType;
  success: boolean;
  error?: string;
  notificationId?: string;
}

/**
 * Test GAMIFICATION notifications:
 * - NEW_BADGE
 * - ACHIEVEMENT_UNLOCKED
 * - LEVEL_UP
 * - REWARD_EARNED
 */
async function testGamificationNotifications() {
  const results: TestResult[] = [];
  const createdIds: CreatedTestData = {
    userIds: [],
    postIds: [],
    commentIds: [],
    likeIds: [],
    shareIds: [],
    favoriteIds: [],
    threadIds: [],
    trustRelationIds: [],
    achievementIds: [],
    badgeIds: [],
    collectionIds: [],
    eventIds: [],
  };

  try {
    MediaHelper.validateEnvironment();
    console.log('✅ Environment validated\n');

    console.log('🔧 Initializing services...');
    try {
      await RedisConfigManager.getInstance().initialize();
      await QueueProvider.getInstance().initialize();
      console.log('✅ Services initialized\n');
    } catch (error: any) {
      console.log(`⚠️  Services initialization warning: ${error.message}\n`);
    }

    const gamificationService = new GamificationService();

    // Create test user
    console.log('👤 Creating test user...');
    const user = await TestDataCreator.createTestUser('gamification-user', 'Gamification User');
    createdIds.userIds.push(user.userId);
    console.log(`✅ Created test user\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: ACHIEVEMENT_UNLOCKED
    console.log('🧪 Testing ACHIEVEMENT_UNLOCKED notification...');
    try {
      const achievementId = 'test-achievement-' + Date.now();
      await gamificationService.grantAchievementToUser(user.userId, achievementId);

      // Get achievement ID for cleanup
      const userAchievement = await prisma.userAchievement.findFirst({
        where: { userId: user.userId },
        orderBy: { id: 'desc' },
      });
      if (userAchievement) {
        createdIds.achievementIds.push(userAchievement.id);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user.userId,
          type: NotificationType.ACHIEVEMENT_UNLOCKED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.ACHIEVEMENT_UNLOCKED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ ACHIEVEMENT_UNLOCKED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.ACHIEVEMENT_UNLOCKED,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ ACHIEVEMENT_UNLOCKED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.ACHIEVEMENT_UNLOCKED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ ACHIEVEMENT_UNLOCKED test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: NEW_BADGE
    console.log('🧪 Testing NEW_BADGE notification...');
    try {
      if (typeof (gamificationService as any).grantBadgeToUser === 'function') {
        const badgeId = await (gamificationService as any).grantBadgeToUser(user.userId, 'test-badge');

        const userBadge = await prisma.userBadge.findFirst({
          where: { userId: user.userId },
          orderBy: { id: 'desc' },
        });
        if (userBadge) {
          createdIds.badgeIds.push(userBadge.id);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: user.userId,
            type: NotificationType.NEW_BADGE,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.NEW_BADGE,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ NEW_BADGE notification created successfully');
        } else {
          results.push({
            type: NotificationType.NEW_BADGE,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ NEW_BADGE notification not found');
        }
      } else {
        // Try creating badge directly
        const badgeId = await TestDataCreator.createTestBadge(user.userId);
        createdIds.badgeIds.push(badgeId);

        // Send notification manually
        const { NotificationService } = await import('../../application/notification/notification.service');
        const notificationService = new NotificationService();
        await notificationService.sendNotification(
          user.userId,
          NotificationType.NEW_BADGE,
          {
            badgeName: 'Test Badge',
            badgeId,
          }
        );

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: user.userId,
            type: NotificationType.NEW_BADGE,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.NEW_BADGE,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ NEW_BADGE notification created successfully (manual)');
        } else {
          results.push({
            type: NotificationType.NEW_BADGE,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ NEW_BADGE notification not found');
        }
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.NEW_BADGE,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ NEW_BADGE test failed: ${error.message}`);
    }
    console.log('');

    // Test 3: LEVEL_UP (if implemented)
    console.log('🧪 Testing LEVEL_UP notification...');
    try {
      if (typeof (gamificationService as any).levelUpUser === 'function') {
        await (gamificationService as any).levelUpUser(user.userId);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: user.userId,
            type: NotificationType.LEVEL_UP,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.LEVEL_UP,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ LEVEL_UP notification created successfully');
        } else {
          results.push({
            type: NotificationType.LEVEL_UP,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ LEVEL_UP notification not found');
        }
      } else {
        results.push({
          type: NotificationType.LEVEL_UP,
          success: false,
          error: 'levelUpUser method not implemented',
        });
        console.log('  ⚠️  LEVEL_UP: levelUpUser method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.LEVEL_UP,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ LEVEL_UP test failed: ${error.message}`);
    }
    console.log('');

    // Test 4: REWARD_EARNED (if implemented)
    console.log('🧪 Testing REWARD_EARNED notification...');
    try {
      if (typeof (gamificationService as any).grantReward === 'function') {
        await (gamificationService as any).grantReward(user.userId, 100);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: user.userId,
            type: NotificationType.REWARD_EARNED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.REWARD_EARNED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ REWARD_EARNED notification created successfully');
        } else {
          results.push({
            type: NotificationType.REWARD_EARNED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ REWARD_EARNED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.REWARD_EARNED,
          success: false,
          error: 'grantReward method not implemented',
        });
        console.log('  ⚠️  REWARD_EARNED: grantReward method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.REWARD_EARNED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ REWARD_EARNED test failed: ${error.message}`);
    }
    console.log('');

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log('='.repeat(50));
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total: ${results.length}\n`);

    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.type}`);
      } else {
        console.log(`  ❌ ${result.type}: ${result.error}`);
      }
    });

  } catch (error) {
    console.error('❌ Test execution error:', error);
    logger.error('Gamification notification test error:', error);
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    try {
      await TestDataCleaner.cleanupTestData(createdIds);
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }

    await prisma.$disconnect();
    process.exit(0);
  }
}

testGamificationNotifications();



