import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { ExpertService } from '../../application/expert/expert.service';
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
 * Test EXPERT notifications:
 * - EXPERT_REQUEST_AVAILABLE
 * - EXPERT_REQUEST_ANSWERED
 */
async function testExpertNotifications() {
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

    const expertService = new ExpertService();

    // Create test users
    console.log('👤 Creating test users...');
    const requester = await TestDataCreator.createTestUser('expert-requester', 'Expert Requester');
    const expert = await TestDataCreator.createTestUser('expert-user', 'Expert User');

    createdIds.userIds.push(requester.userId, expert.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: EXPERT_REQUEST_AVAILABLE
    console.log('🧪 Testing EXPERT_REQUEST_AVAILABLE notification...');
    try {
      if (typeof expertService.createExpertRequest === 'function') {
        const request = await expertService.createExpertRequest(requester.userId, {
          category: 'ELECTRONICS',
          description: 'Test expert request for notification testing',
          tipsAmount: 100,
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Expert should receive notification
        const notification = await prisma.notification.findFirst({
          where: {
            userId: expert.userId,
            type: NotificationType.EXPERT_REQUEST_AVAILABLE,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.EXPERT_REQUEST_AVAILABLE,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ EXPERT_REQUEST_AVAILABLE notification created successfully');
          console.log(`     Title: ${notification.title}`);
          console.log(`     Message: ${notification.message}`);
        } else {
          results.push({
            type: NotificationType.EXPERT_REQUEST_AVAILABLE,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ EXPERT_REQUEST_AVAILABLE notification not found');
        }
      } else {
        results.push({
          type: NotificationType.EXPERT_REQUEST_AVAILABLE,
          success: false,
          error: 'createRequest method not found or has different signature',
        });
        console.log('  ⚠️  EXPERT_REQUEST_AVAILABLE: createRequest method not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.EXPERT_REQUEST_AVAILABLE,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ EXPERT_REQUEST_AVAILABLE test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: EXPERT_REQUEST_ANSWERED (if implemented)
    console.log('🧪 Testing EXPERT_REQUEST_ANSWERED notification...');
    try {
      if (typeof (expertService as any).answerRequest === 'function') {
        // First create a request
        const request = await expertService.createExpertRequest(requester.userId, {
          category: 'ELECTRONICS',
          description: 'Test expert request for answer notification',
          tipsAmount: 100,
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Answer the request
        await (expertService as any).answerRequest(expert.userId, request.id, 'This is a test answer');

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: requester.userId,
            type: NotificationType.EXPERT_REQUEST_ANSWERED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.EXPERT_REQUEST_ANSWERED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ EXPERT_REQUEST_ANSWERED notification created successfully');
        } else {
          results.push({
            type: NotificationType.EXPERT_REQUEST_ANSWERED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ EXPERT_REQUEST_ANSWERED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.EXPERT_REQUEST_ANSWERED,
          success: false,
          error: 'answerRequest method not implemented',
        });
        console.log('  ⚠️  EXPERT_REQUEST_ANSWERED: answerRequest method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.EXPERT_REQUEST_ANSWERED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ EXPERT_REQUEST_ANSWERED test failed: ${error.message}`);
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
    logger.error('Expert notification test error:', error);
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

testExpertNotifications();

