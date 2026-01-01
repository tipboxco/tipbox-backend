import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { InteractionService } from '../../application/interaction/interaction.service';
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
 * Test POST interaction notifications:
 * - POST_LIKED
 * - POST_COMMENTED
 * - POST_SHARED
 * - POST_FAVORITED
 */
async function testPostNotifications() {
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
    // Validate environment
    MediaHelper.validateEnvironment();
    console.log('✅ Environment validated\n');

    // Initialize services
    console.log('🔧 Initializing services...');
    try {
      await RedisConfigManager.getInstance().initialize();
      await QueueProvider.getInstance().initialize();
      console.log('✅ Services initialized\n');
    } catch (error: any) {
      console.log(`⚠️  Services initialization warning: ${error.message}`);
      console.log('⚠️  Continuing without Redis/Queue (notifications will still be created in DB)\n');
    }

    const interactionService = new InteractionService();
    const notificationService = new NotificationService();

    // Create test users
    console.log('👤 Creating test users...');
    const postOwner = await TestDataCreator.createTestUser('post-owner', 'Post Owner');
    const liker = await TestDataCreator.createTestUser('liker', 'Liker User');
    const commenter = await TestDataCreator.createTestUser('commenter', 'Commenter User');
    const sharer = await TestDataCreator.createTestUser('sharer', 'Sharer User');
    const favoriter = await TestDataCreator.createTestUser('favoriter', 'Favoriter User');

    createdIds.userIds.push(postOwner.userId, liker.userId, commenter.userId, sharer.userId, favoriter.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    // Create test post
    console.log('📝 Creating test post...');
    const postId = await TestDataCreator.createTestPost(postOwner.userId);
    createdIds.postIds.push(postId);
    console.log(`✅ Created test post: ${postId}\n`);

    // Wait a bit for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: POST_LIKED
    console.log('🧪 Testing POST_LIKED notification...');
    try {
      const like = await interactionService.likePost(liker.userId, postId);
      createdIds.likeIds.push(like.id);

      // Wait for notification to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notification
      const notification = await prisma.notification.findFirst({
        where: {
          userId: postOwner.userId,
          type: NotificationType.POST_LIKED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.POST_LIKED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ POST_LIKED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.POST_LIKED,
          success: false,
          error: 'Notification not found in database',
        });
        console.log('  ❌ POST_LIKED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.POST_LIKED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ POST_LIKED test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: POST_COMMENTED
    console.log('🧪 Testing POST_COMMENTED notification...');
    try {
      const comment = await interactionService.createComment(commenter.userId, postId, 'This is a test comment for notification testing!');
      createdIds.commentIds.push(comment.id);

      // Wait for notification to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notification
      const notification = await prisma.notification.findFirst({
        where: {
          userId: postOwner.userId,
          type: NotificationType.POST_COMMENTED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.POST_COMMENTED,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ POST_COMMENTED notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.POST_COMMENTED,
          success: false,
          error: 'Notification not found in database',
        });
        console.log('  ❌ POST_COMMENTED notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.POST_COMMENTED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ POST_COMMENTED test failed: ${error.message}`);
    }
    console.log('');

    // Test 3: POST_SHARED (if method exists)
    console.log('🧪 Testing POST_SHARED notification...');
    try {
      // sharePost method exists
      const { ShareType } = await import('../../domain/interaction/share-type.enum');
      const share = await interactionService.sharePost(sharer.userId, postId, ShareType.INTERNAL_REPOST);
        createdIds.shareIds.push(share.id);

        // Wait for notification to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify notification
        const notification = await prisma.notification.findFirst({
          where: {
            userId: postOwner.userId,
            type: NotificationType.POST_SHARED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.POST_SHARED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ POST_SHARED notification created successfully');
          console.log(`     Title: ${notification.title}`);
          console.log(`     Message: ${notification.message}`);
        } else {
          results.push({
            type: NotificationType.POST_SHARED,
            success: false,
            error: 'Notification not found in database',
          });
          console.log('  ❌ POST_SHARED notification not found');
        }
    } catch (error: any) {
      results.push({
        type: NotificationType.POST_SHARED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ POST_SHARED test failed: ${error.message}`);
    }
    console.log('');

    // Test 4: POST_FAVORITED (if method exists)
    console.log('🧪 Testing POST_FAVORITED notification...');
    try {
      // favoritePost method exists
      const favorite = await interactionService.favoritePost(favoriter.userId, postId);
      createdIds.favoriteIds.push(favorite.id);

        // Wait for notification to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify notification
        const notification = await prisma.notification.findFirst({
          where: {
            userId: postOwner.userId,
            type: NotificationType.POST_FAVORITED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.POST_FAVORITED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ POST_FAVORITED notification created successfully');
          console.log(`     Title: ${notification.title}`);
          console.log(`     Message: ${notification.message}`);
        } else {
          results.push({
            type: NotificationType.POST_FAVORITED,
            success: false,
            error: 'Notification not found in database',
          });
          console.log('  ❌ POST_FAVORITED notification not found');
        }
    } catch (error: any) {
      results.push({
        type: NotificationType.POST_FAVORITED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ POST_FAVORITED test failed: ${error.message}`);
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
    logger.error('Post notification test error:', error);
  } finally {
    // Cleanup
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

// Run tests
testPostNotifications();

