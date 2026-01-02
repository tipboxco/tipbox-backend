import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../application/notification/notification.service';
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
 * Test SYSTEM notifications:
 * - SYSTEM_ANNOUNCEMENT
 * - ACCOUNT_SECURITY
 * - TIPS_RECEIVED
 * - TIPS_SENT
 */
async function testSystemNotifications() {
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

    const notificationService = new NotificationService();

    // Create test users
    console.log('👤 Creating test users...');
    const user1 = await TestDataCreator.createTestUser('system-user1', 'System User 1');
    const user2 = await TestDataCreator.createTestUser('system-user2', 'System User 2');

    createdIds.userIds.push(user1.userId, user2.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: SYSTEM_ANNOUNCEMENT
    console.log('🧪 Testing SYSTEM_ANNOUNCEMENT notification...');
    try {
      await notificationService.sendNotification(
        user1.userId,
        NotificationType.SYSTEM_ANNOUNCEMENT,
        {
          title: 'Test System Announcement',
          message: 'This is a test system announcement for notification testing.',
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user1.userId,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ SYSTEM_ANNOUNCEMENT notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ SYSTEM_ANNOUNCEMENT notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ SYSTEM_ANNOUNCEMENT test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: ACCOUNT_SECURITY
    console.log('🧪 Testing ACCOUNT_SECURITY notification...');
    try {
      await notificationService.sendNotification(
        user1.userId,
        NotificationType.ACCOUNT_SECURITY,
        {
          title: 'Security Alert',
          message: 'A new device has logged into your account.',
          securityEvent: 'NEW_DEVICE_LOGIN',
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user1.userId,
          type: NotificationType.ACCOUNT_SECURITY,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.ACCOUNT_SECURITY,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ ACCOUNT_SECURITY notification created successfully');
      } else {
        results.push({
          type: NotificationType.ACCOUNT_SECURITY,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ ACCOUNT_SECURITY notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.ACCOUNT_SECURITY,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ ACCOUNT_SECURITY test failed: ${error.message}`);
    }
    console.log('');

    // Test 3: TIPS_RECEIVED
    console.log('🧪 Testing TIPS_RECEIVED notification...');
    try {
      await notificationService.sendNotification(
        user1.userId,
        NotificationType.TIPS_RECEIVED,
        {
          senderName: user2.userId,
          senderId: user2.userId,
          amount: 100,
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user1.userId,
          type: NotificationType.TIPS_RECEIVED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.TIPS_RECEIVED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ TIPS_RECEIVED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.TIPS_RECEIVED,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ TIPS_RECEIVED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.TIPS_RECEIVED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ TIPS_RECEIVED test failed: ${error.message}`);
    }
    console.log('');

    // Test 4: TIPS_SENT
    console.log('🧪 Testing TIPS_SENT notification...');
    try {
      await notificationService.sendNotification(
        user2.userId,
        NotificationType.TIPS_SENT,
        {
          recipientName: user1.userId,
          recipientId: user1.userId,
          amount: 100,
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user2.userId,
          type: NotificationType.TIPS_SENT,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.TIPS_SENT,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ TIPS_SENT notification created successfully');
      } else {
        results.push({
          type: NotificationType.TIPS_SENT,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ TIPS_SENT notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.TIPS_SENT,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ TIPS_SENT test failed: ${error.message}`);
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
    logger.error('System notification test error:', error);
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

testSystemNotifications();


