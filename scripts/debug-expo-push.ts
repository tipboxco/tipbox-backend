import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { ExpoPushService } from '../src/infrastructure/push/expo-push.service';
import logger from '../src/infrastructure/logger/logger';

const prisma = new PrismaClient();

async function debugExpoPush() {
  try {
    console.log('🔍 Expo Push Notification Debug Tool\n');
    console.log('='.repeat(60));

    // 1. Check Expo Access Token
    console.log('\n1️⃣  Checking Expo Access Token...');
    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;
    if (expoAccessToken) {
      console.log('✅ EXPO_ACCESS_TOKEN is set');
      console.log(`   Token: ${expoAccessToken.substring(0, 10)}...`);
    } else {
      console.log('⚠️  EXPO_ACCESS_TOKEN is NOT set');
      console.log('   Note: This is optional for development, but required for production');
    }

    // 2. Check Push Tokens in Database
    console.log('\n2️⃣  Checking Push Tokens in Database...');
    const pushTokens = await prisma.pushToken.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      take: 10,
    });

    console.log(`   Found ${pushTokens.length} active push tokens`);
    if (pushTokens.length === 0) {
      console.log('   ⚠️  No active push tokens found!');
      console.log('   💡 Users need to register their push tokens via /notifications/push-token endpoint');
    } else {
      console.log('\n   Active Push Tokens:');
      pushTokens.forEach((token, index) => {
        console.log(`   ${index + 1}. User: ${token.user?.email || token.userId}`);
        console.log(`      Token: ${token.token}`);
        console.log(`      Device: ${token.deviceType}`);
        console.log(`      Last Used: ${token.lastUsedAt.toISOString()}`);
        console.log('');
      });
    }

    // 3. Validate Push Tokens
    console.log('\n3️⃣  Validating Push Tokens...');
    const expoPushService = new ExpoPushService();
    let validCount = 0;
    let invalidCount = 0;

    for (const token of pushTokens) {
      const isValid = expoPushService.isValidPushToken(token.token);
      if (isValid) {
        validCount++;
        console.log(`   ✅ ${token.token.substring(0, 30)}... (valid)`);
      } else {
        invalidCount++;
        console.log(`   ❌ ${token.token.substring(0, 30)}... (invalid)`);
      }
    }

    console.log(`\n   Valid: ${validCount}, Invalid: ${invalidCount}`);

    // 4. Check Recent Notifications
    console.log('\n4️⃣  Checking Recent Notifications...');
    const recentNotifications = await prisma.notification.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    console.log(`   Found ${recentNotifications.length} recent notifications`);
    if (recentNotifications.length > 0) {
      console.log('\n   Recent Notifications:');
      recentNotifications.forEach((notif, index) => {
        console.log(`   ${index + 1}. Type: ${notif.type}`);
        console.log(`      User: ${notif.user?.email || notif.userId}`);
        console.log(`      Title: ${notif.title}`);
        console.log(`      Created: ${notif.createdAt.toISOString()}`);
        console.log('');
      });
    }

    // 5. Check Notification Settings
    console.log('\n5️⃣  Checking User Notification Settings...');
    if (pushTokens.length > 0) {
      const userId = pushTokens[0].userId;
      const settings = await prisma.userSettings.findUnique({
        where: {
          userId: userId,
        },
      });

      if (settings) {
        console.log(`   User: ${pushTokens[0].user?.email || userId}`);
        console.log(`   Receive Notifications: ${settings.receiveNotifications}`);
        console.log(`   Push Enabled: ${settings.notificationPushEnabled}`);
        console.log(`   In-App Enabled: ${settings.notificationInAppEnabled}`);
        console.log(`   Email Enabled: ${settings.notificationEmailEnabled}`);
      } else {
        console.log('   ⚠️  No settings found (using defaults)');
      }
    }

    // 6. Expo Go Specific Notes
    console.log('\n6️⃣  Expo Go Specific Notes...');
    console.log('   ⚠️  IMPORTANT: Expo Go has limitations for push notifications:');
    console.log('   - Push notifications work in Expo Go, but may have delays');
    console.log('   - For better reliability, use a development build or production build');
    console.log('   - Make sure the app has notification permissions');
    console.log('   - Check that push token is registered correctly');
    console.log('   - Verify notification settings are enabled');

    // 7. Recommendations
    console.log('\n7️⃣  Recommendations:');
    if (pushTokens.length === 0) {
      console.log('   ❌ No push tokens found - users need to register tokens');
      console.log('   💡 Frontend should call: POST /notifications/push-token');
    }
    if (!expoAccessToken) {
      console.log('   ⚠️  EXPO_ACCESS_TOKEN not set - may affect production push notifications');
    }
    if (invalidCount > 0) {
      console.log(`   ⚠️  ${invalidCount} invalid push tokens found - should be cleaned up`);
    }
    console.log('   ✅ Check notification worker logs: docker-compose logs -f backend | grep notification');
    console.log('   ✅ Test push notification: Use test script or trigger a real notification');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug completed\n');

  } catch (error) {
    console.error('❌ Debug error:', error);
    logger.error('Expo push debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugExpoPush();

