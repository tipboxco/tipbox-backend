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
 * Test COLLECTION notifications:
 * - COLLECTION_POST_ADDED
 * - COLLECTION_SHARED
 */
async function testCollectionNotifications() {
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

    // Create test users
    console.log('👤 Creating test users...');
    const collectionOwner = await TestDataCreator.createTestUser('collection-owner', 'Collection Owner');
    const postOwner = await TestDataCreator.createTestUser('collection-post-owner', 'Post Owner');
    const viewer = await TestDataCreator.createTestUser('collection-viewer', 'Collection Viewer');

    createdIds.userIds.push(collectionOwner.userId, postOwner.userId, viewer.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    // Create test post
    console.log('📝 Creating test post...');
    const postId = await TestDataCreator.createTestPost(postOwner.userId);
    createdIds.postIds.push(postId);
    console.log(`✅ Created test post\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: COLLECTION_POST_ADDED
    console.log('🧪 Testing COLLECTION_POST_ADDED notification...');
    try {
      // Create collection
      const collection = await prisma.contentCollection.create({
        data: {
          userId: collectionOwner.userId,
          name: `Test Collection ${Date.now()}`,
          description: 'Test collection for notification testing',
        },
      });
      createdIds.collectionIds.push(collection.id);

      // Add post to collection (if service exists)
      const { NotificationService } = await import('../../application/notification/notification.service');
      const notificationService = new NotificationService();

      // Manually trigger notification since collection service may not exist
      await notificationService.sendNotification(
        postOwner.userId,
        NotificationType.COLLECTION_POST_ADDED,
        {
          collectionName: collection.name,
          collectionId: collection.id,
          postId,
          userName: collectionOwner.userId,
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: postOwner.userId,
          type: NotificationType.COLLECTION_POST_ADDED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.COLLECTION_POST_ADDED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ COLLECTION_POST_ADDED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.COLLECTION_POST_ADDED,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ COLLECTION_POST_ADDED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.COLLECTION_POST_ADDED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ COLLECTION_POST_ADDED test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: COLLECTION_SHARED
    console.log('🧪 Testing COLLECTION_SHARED notification...');
    try {
      const { NotificationService } = await import('../../application/notification/notification.service');
      const notificationService = new NotificationService();

      const collection = await prisma.contentCollection.findFirst({
        where: { userId: collectionOwner.userId },
      });

      if (collection) {
        await notificationService.sendNotification(
          viewer.userId,
          NotificationType.COLLECTION_SHARED,
          {
            collectionName: collection.name,
            collectionId: collection.id,
            userName: collectionOwner.userId,
          }
        );

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: viewer.userId,
            type: NotificationType.COLLECTION_SHARED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.COLLECTION_SHARED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ COLLECTION_SHARED notification created successfully');
        } else {
          results.push({
            type: NotificationType.COLLECTION_SHARED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ COLLECTION_SHARED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.COLLECTION_SHARED,
          success: false,
          error: 'Collection not found',
        });
        console.log('  ❌ COLLECTION_SHARED: Collection not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.COLLECTION_SHARED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ COLLECTION_SHARED test failed: ${error.message}`);
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
    logger.error('Collection notification test error:', error);
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

testCollectionNotifications();

