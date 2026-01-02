import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { UserService } from '../../application/user/user.service';
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
 * Test TRUST notifications:
 * - NEW_TRUSTER
 * - NEW_TRUSTED_BY
 */
async function testTrustNotifications() {
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

    const userService = new UserService();

    // Create test users
    console.log('👤 Creating test users...');
    const user1 = await TestDataCreator.createTestUser('trust-user1', 'User 1');
    const user2 = await TestDataCreator.createTestUser('trust-user2', 'User 2');

    createdIds.userIds.push(user1.userId, user2.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: NEW_TRUSTER (user1 trusts user2, so user2 gets notification)
    console.log('🧪 Testing NEW_TRUSTER notification...');
    try {
      await userService.addTrust(user1.userId, user2.userId);

      // Get trust relation ID for cleanup
      const trustRelation = await prisma.trustRelation.findFirst({
        where: {
          trusterId: user1.userId,
          trustedId: user2.userId,
        },
      });
      if (trustRelation) {
        createdIds.trustRelationIds.push(trustRelation.id);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: user2.userId, // user2 receives notification
          type: NotificationType.NEW_TRUSTER,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.NEW_TRUSTER,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ NEW_TRUSTER notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.NEW_TRUSTER,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ NEW_TRUSTER notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.NEW_TRUSTER,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ NEW_TRUSTER test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: NEW_TRUSTED_BY (reverse direction - if implemented)
    console.log('🧪 Testing NEW_TRUSTED_BY notification...');
    try {
      // Remove existing trust first
      await userService.removeTrust(user1.userId, user2.userId);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Add trust in reverse direction
      await userService.addTrust(user2.userId, user1.userId);

      const trustRelation = await prisma.trustRelation.findFirst({
        where: {
          trusterId: user2.userId,
          trustedId: user1.userId,
        },
      });
      if (trustRelation) {
        createdIds.trustRelationIds.push(trustRelation.id);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // NEW_TRUSTED_BY might be the same as NEW_TRUSTER or a separate type
      const notification = await prisma.notification.findFirst({
        where: {
          userId: user1.userId,
          type: NotificationType.NEW_TRUSTED_BY,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.NEW_TRUSTED_BY,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ NEW_TRUSTED_BY notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        // Check if NEW_TRUSTER was sent instead
        const trustNotification = await prisma.notification.findFirst({
          where: {
            userId: user1.userId,
            type: NotificationType.NEW_TRUSTER,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (trustNotification) {
          results.push({
            type: NotificationType.NEW_TRUSTED_BY,
            success: false,
            error: 'NEW_TRUSTER sent instead of NEW_TRUSTED_BY (may be same implementation)',
          });
          console.log('  ⚠️  NEW_TRUSTED_BY: NEW_TRUSTER sent instead (may be same implementation)');
        } else {
          results.push({
            type: NotificationType.NEW_TRUSTED_BY,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ NEW_TRUSTED_BY notification not found');
        }
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.NEW_TRUSTED_BY,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ NEW_TRUSTED_BY test failed: ${error.message}`);
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
    logger.error('Trust notification test error:', error);
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

testTrustNotifications();


