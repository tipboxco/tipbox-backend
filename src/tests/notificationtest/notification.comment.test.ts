import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { InteractionService } from '../../application/interaction/interaction.service';
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
 * Test COMMENT interaction notifications:
 * - COMMENT_LIKED
 * - COMMENT_REPLIED
 */
async function testCommentNotifications() {
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

    const interactionService = new InteractionService();

    // Create test users
    console.log('👤 Creating test users...');
    const postOwner = await TestDataCreator.createTestUser('comment-post-owner', 'Post Owner');
    const commenter = await TestDataCreator.createTestUser('commenter', 'Commenter');
    const liker = await TestDataCreator.createTestUser('comment-liker', 'Comment Liker');
    const replier = await TestDataCreator.createTestUser('comment-replier', 'Comment Replier');

    createdIds.userIds.push(postOwner.userId, commenter.userId, liker.userId, replier.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    // Create test post and comment
    console.log('📝 Creating test post and comment...');
    const postId = await TestDataCreator.createTestPost(postOwner.userId);
    createdIds.postIds.push(postId);

    const comment = await interactionService.createComment(commenter.userId, postId, 'Original comment for testing');
    createdIds.commentIds.push(comment.id);
    console.log(`✅ Created test post and comment\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: COMMENT_LIKED
    console.log('🧪 Testing COMMENT_LIKED notification...');
    try {
      // likeComment exists but may not send notification - check implementation
      await interactionService.likeComment(liker.userId, comment.id);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: commenter.userId,
            type: NotificationType.COMMENT_LIKED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.COMMENT_LIKED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ COMMENT_LIKED notification created successfully');
          console.log(`     Title: ${notification.title}`);
          console.log(`     Message: ${notification.message}`);
        } else {
          results.push({
            type: NotificationType.COMMENT_LIKED,
            success: false,
            error: 'Notification not found (likeComment may not send notification)',
          });
          console.log('  ⚠️  COMMENT_LIKED: Notification not found (likeComment may not send notification)');
        }
    } catch (error: any) {
      results.push({
        type: NotificationType.COMMENT_LIKED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ COMMENT_LIKED test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: COMMENT_REPLIED
    console.log('🧪 Testing COMMENT_REPLIED notification...');
    try {
      // Use createComment with parentId to reply
      const reply = await interactionService.createComment(replier.userId, postId, 'This is a reply to the comment', comment.id);
      createdIds.commentIds.push(reply.id);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: commenter.userId,
            type: NotificationType.COMMENT_REPLIED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.COMMENT_REPLIED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ COMMENT_REPLIED notification created successfully');
          console.log(`     Title: ${notification.title}`);
          console.log(`     Message: ${notification.message}`);
        } else {
          results.push({
            type: NotificationType.COMMENT_REPLIED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ COMMENT_REPLIED notification not found');
        }
    } catch (error: any) {
      results.push({
        type: NotificationType.COMMENT_REPLIED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ COMMENT_REPLIED test failed: ${error.message}`);
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
    logger.error('Comment notification test error:', error);
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

testCommentNotifications();

