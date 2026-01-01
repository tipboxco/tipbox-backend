import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { MessagingService } from '../../application/messaging/messaging.service';
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
 * Test MESSAGE notifications:
 * - NEW_MESSAGE
 * - DM_REQUEST_RECEIVED
 * - DM_REQUEST_ACCEPTED
 * - SUPPORT_REQUEST_ACCEPTED
 */
async function testMessageNotifications() {
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

    const messagingService = new MessagingService();

    // Create test users
    console.log('👤 Creating test users...');
    const sender = await TestDataCreator.createTestUser('message-sender', 'Message Sender');
    const recipient = await TestDataCreator.createTestUser('message-recipient', 'Message Recipient');

    createdIds.userIds.push(sender.userId, recipient.userId);
    console.log(`✅ Created ${createdIds.userIds.length} test users\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: NEW_MESSAGE
    console.log('🧪 Testing NEW_MESSAGE notification...');
    try {
      const message = 'Hello! This is a test message for notification testing.';
      await messagingService.sendDirectMessage(sender.userId, recipient.userId, message);

      // Get thread ID for cleanup
      const thread = await prisma.dMThread.findFirst({
        where: {
          OR: [
            { senderId: sender.userId, recipientId: recipient.userId },
            { senderId: recipient.userId, recipientId: sender.userId },
          ],
        },
      });
      if (thread) {
        createdIds.threadIds.push(thread.id);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const notification = await prisma.notification.findFirst({
        where: {
          userId: recipient.userId,
          type: NotificationType.NEW_MESSAGE,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        results.push({
          type: NotificationType.NEW_MESSAGE,
          success: true,
          notificationId: notification.id,
        });
        console.log('  ✅ NEW_MESSAGE notification created successfully');
        console.log(`     Title: ${notification.title}`);
        console.log(`     Message: ${notification.message}`);
      } else {
        results.push({
          type: NotificationType.NEW_MESSAGE,
          success: false,
          error: 'Notification not found',
        });
        console.log('  ❌ NEW_MESSAGE notification not found');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.NEW_MESSAGE,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ NEW_MESSAGE test failed: ${error.message}`);
    }
    console.log('');

    // Test 2: DM_REQUEST_RECEIVED (if implemented)
    console.log('🧪 Testing DM_REQUEST_RECEIVED notification...');
    try {
      if (typeof (messagingService as any).createDMRequest === 'function') {
        await (messagingService as any).createDMRequest(sender.userId, recipient.userId);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: recipient.userId,
            type: NotificationType.DM_REQUEST_RECEIVED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.DM_REQUEST_RECEIVED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ DM_REQUEST_RECEIVED notification created successfully');
        } else {
          results.push({
            type: NotificationType.DM_REQUEST_RECEIVED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ DM_REQUEST_RECEIVED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.DM_REQUEST_RECEIVED,
          success: false,
          error: 'createDMRequest method not implemented',
        });
        console.log('  ⚠️  DM_REQUEST_RECEIVED: createDMRequest method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.DM_REQUEST_RECEIVED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ DM_REQUEST_RECEIVED test failed: ${error.message}`);
    }
    console.log('');

    // Test 3: DM_REQUEST_ACCEPTED (if implemented)
    console.log('🧪 Testing DM_REQUEST_ACCEPTED notification...');
    try {
      if (typeof (messagingService as any).acceptDMRequest === 'function') {
        await (messagingService as any).acceptDMRequest(recipient.userId, sender.userId);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: sender.userId,
            type: NotificationType.DM_REQUEST_ACCEPTED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.DM_REQUEST_ACCEPTED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ DM_REQUEST_ACCEPTED notification created successfully');
        } else {
          results.push({
            type: NotificationType.DM_REQUEST_ACCEPTED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ DM_REQUEST_ACCEPTED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.DM_REQUEST_ACCEPTED,
          success: false,
          error: 'acceptDMRequest method not implemented',
        });
        console.log('  ⚠️  DM_REQUEST_ACCEPTED: acceptDMRequest method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.DM_REQUEST_ACCEPTED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ DM_REQUEST_ACCEPTED test failed: ${error.message}`);
    }
    console.log('');

    // Test 4: SUPPORT_REQUEST_ACCEPTED (if implemented)
    console.log('🧪 Testing SUPPORT_REQUEST_ACCEPTED notification...');
    try {
      if (typeof (messagingService as any).acceptSupportRequest === 'function') {
        await (messagingService as any).acceptSupportRequest(recipient.userId, sender.userId);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const notification = await prisma.notification.findFirst({
          where: {
            userId: sender.userId,
            type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notification) {
          results.push({
            type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
            success: true,
            notificationId: notification.id,
          });
          console.log('  ✅ SUPPORT_REQUEST_ACCEPTED notification created successfully');
        } else {
          results.push({
            type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
            success: false,
            error: 'Notification not found',
          });
          console.log('  ❌ SUPPORT_REQUEST_ACCEPTED notification not found');
        }
      } else {
        results.push({
          type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
          success: false,
          error: 'acceptSupportRequest method not implemented',
        });
        console.log('  ⚠️  SUPPORT_REQUEST_ACCEPTED: acceptSupportRequest method not implemented');
      }
    } catch (error: any) {
      results.push({
        type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
        success: false,
        error: error.message,
      });
      console.log(`  ❌ SUPPORT_REQUEST_ACCEPTED test failed: ${error.message}`);
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
    logger.error('Message notification test error:', error);
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

testMessageNotifications();

