import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
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
 * Test EVENT notifications:
 * - EVENT_STARTED
 * - EVENT_ENDING_SOON
 * - EVENT_REWARD_AVAILABLE
 */
async function testEventNotifications() {
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

    // Create test user
    console.log('👤 Creating test user...');
    const user = await TestDataCreator.createTestUser('event-user', 'Event User');
    createdIds.userIds.push(user.userId);
    console.log(`✅ Created test user\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: EVENT_STARTED
    console.log('🧪 Testing EVENT_STARTED notification...');
    try {
      const { NotificationService } = await import('../../application/notification/notification.service');
      const notificationService = new NotificationService();

      await notificationService.sendNotification(
        user.userId,
        NotificationType.EVENT_STARTED,
        {
          eventName: 'Test Event',
          eventId: 'test-event-' + Date.now(),
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user.userId,
          type: NotificationType.EVENT_STARTED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.EVENT_STARTED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ EVENT_STARTED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.EVENT_STARTED,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ EVENT_STARTED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.EVENT_STARTED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ EVENT_STARTED test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: EVENT_ENDING_SOON
    console.log('🧪 Testing EVENT_ENDING_SOON notification...');
    try {
      const { NotificationService } = await import('../../application/notification/notification.service');
      const notificationService = new NotificationService();

      await notificationService.sendNotification(
        user.userId,
        NotificationType.EVENT_ENDING_SOON,
        {
          eventName: 'Test Event',
          eventId: 'test-event-' + Date.now(),
          hoursRemaining: 24,
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user.userId,
          type: NotificationType.EVENT_ENDING_SOON,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.EVENT_ENDING_SOON,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ EVENT_ENDING_SOON notification created successfully');
      } else {
        results.push({
          type: NotificationType.EVENT_ENDING_SOON,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ EVENT_ENDING_SOON notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.EVENT_ENDING_SOON,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ EVENT_ENDING_SOON test failed: ${error.message}`);
    }
    console.log('');

    // Test 3: EVENT_REWARD_AVAILABLE
    console.log('🧪 Testing EVENT_REWARD_AVAILABLE notification...');
    try {
      const { NotificationService } = await import('../../application/notification/notification.service');
      const notificationService = new NotificationService();

      await notificationService.sendNotification(
        user.userId,
        NotificationType.EVENT_REWARD_AVAILABLE,
        {
          eventName: 'Test Event',
          eventId: 'test-event-' + Date.now(),
          rewardAmount: 500,
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user.userId,
          type: NotificationType.EVENT_REWARD_AVAILABLE,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.EVENT_REWARD_AVAILABLE,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ EVENT_REWARD_AVAILABLE notification created successfully');
      } else {
        results.push({
          type: NotificationType.EVENT_REWARD_AVAILABLE,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ EVENT_REWARD_AVAILABLE notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.EVENT_REWARD_AVAILABLE,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ EVENT_REWARD_AVAILABLE test failed: ${error.message}`);
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
    logger.error('Event notification test error:', error);
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

testEventNotifications();

