import { PrismaClient } from '@prisma/client';
import { CreatedTestData } from './test-data-creator';

const prisma = new PrismaClient();

/**
 * Test data cleaner for notification tests
 * Cleans up test data in correct order (respecting foreign keys)
 */
export class TestDataCleaner {
  /**
   * Clean up all test data
   */
  static async cleanupTestData(createdIds: CreatedTestData): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    try {
      // 1. Clean up notifications first (no dependencies)
      if (createdIds.userIds.length > 0) {
        await prisma.notification.deleteMany({
          where: {
            userId: { in: createdIds.userIds },
          },
        });
        console.log('  ✓ Notifications cleaned');
      }

      // 2. Clean up interactions
      if (createdIds.favoriteIds.length > 0) {
        await prisma.contentFavorite.deleteMany({
          where: { id: { in: createdIds.favoriteIds } },
        });
      }
      if (createdIds.shareIds.length > 0) {
        await prisma.contentShare.deleteMany({
          where: { id: { in: createdIds.shareIds } },
        });
      }
      if (createdIds.likeIds.length > 0) {
        await prisma.contentLike.deleteMany({
          where: { id: { in: createdIds.likeIds } },
        });
      }
      if (createdIds.commentIds.length > 0) {
        await prisma.contentComment.deleteMany({
          where: { id: { in: createdIds.commentIds } },
        });
      }
      console.log('  ✓ Interactions cleaned');

      // 3. Clean up post media
      if (createdIds.postIds.length > 0) {
        await prisma.postMedia.deleteMany({
          where: { postId: { in: createdIds.postIds } },
        });
      }

      // 4. Clean up posts
      if (createdIds.postIds.length > 0) {
        await prisma.contentPost.deleteMany({
          where: { id: { in: createdIds.postIds } },
        });
        console.log('  ✓ Posts cleaned');
      }

      // 5. Clean up DM threads and messages
      if (createdIds.threadIds.length > 0) {
        await prisma.dMMessage.deleteMany({
          where: { threadId: { in: createdIds.threadIds } },
        });
        await prisma.dMThread.deleteMany({
          where: { id: { in: createdIds.threadIds } },
        });
        console.log('  ✓ DM threads cleaned');
      }

      // 6. Clean up trust relations
      if (createdIds.trustRelationIds.length > 0) {
        await prisma.trustRelation.deleteMany({
          where: { id: { in: createdIds.trustRelationIds } },
        });
        console.log('  ✓ Trust relations cleaned');
      }

      // 7. Clean up achievements
      if (createdIds.achievementIds.length > 0) {
        await prisma.userAchievement.deleteMany({
          where: { id: { in: createdIds.achievementIds } },
        });
        console.log('  ✓ Achievements cleaned');
      }

      // 8. Clean up badges
      if (createdIds.badgeIds.length > 0) {
        await prisma.userBadge.deleteMany({
          where: { id: { in: createdIds.badgeIds } },
        });
        console.log('  ✓ Badges cleaned');
      }

      // 9. Clean up collections
      if (createdIds.collectionIds.length > 0) {
        await prisma.contentCollection.deleteMany({
          where: { id: { in: createdIds.collectionIds } },
        });
        console.log('  ✓ Collections cleaned');
      }

      // 10. Clean up users (last, as they have many dependencies)
      if (createdIds.userIds.length > 0) {
        // Delete user avatars
        await prisma.userAvatar.deleteMany({
          where: { userId: { in: createdIds.userIds } },
        });

        // Delete user settings
        await prisma.userSettings.deleteMany({
          where: { userId: { in: createdIds.userIds } },
        });

        // Delete profiles
        await prisma.profile.deleteMany({
          where: { userId: { in: createdIds.userIds } },
        });

        // Delete users
        await prisma.user.deleteMany({
          where: { id: { in: createdIds.userIds } },
        });
        console.log('  ✓ Users cleaned');
      }

      console.log('✅ All test data cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning up test data:', error);
      throw error;
    }
  }

  /**
   * Clean up test users and all their data
   */
  static async cleanupTestUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    console.log(`🧹 Cleaning up ${userIds.length} test user(s)...`);

    try {
      // Delete all user-related data
      await prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.contentFavorite.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.contentLike.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.contentComment.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.contentPost.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.dMMessage.deleteMany({
        where: {
          senderId: { in: userIds },
        },
      });

      await prisma.dMThread.deleteMany({
        where: {
          OR: [
            { userOneId: { in: userIds } },
            { userTwoId: { in: userIds } },
          ],
        },
      });

      await prisma.trustRelation.deleteMany({
        where: {
          OR: [
            { trusterId: { in: userIds } },
            { trustedUserId: { in: userIds } },
          ],
        },
      });

      await prisma.userAvatar.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.userSettings.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.profile.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });

      console.log('✅ Test users cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning up test users:', error);
      throw error;
    }
  }

  /**
   * Clean up test posts and interactions
   */
  static async cleanupTestPosts(postIds: string[]): Promise<void> {
    if (postIds.length === 0) return;

    console.log(`🧹 Cleaning up ${postIds.length} test post(s)...`);

    try {
      await prisma.postMedia.deleteMany({
        where: { postId: { in: postIds } },
      });

      await prisma.contentFavorite.deleteMany({
        where: { postId: { in: postIds } },
      });

      await prisma.contentLike.deleteMany({
        where: { postId: { in: postIds } },
      });

      await prisma.contentComment.deleteMany({
        where: { postId: { in: postIds } },
      });

      await prisma.contentPost.deleteMany({
        where: { id: { in: postIds } },
      });

      console.log('✅ Test posts cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning up test posts:', error);
      throw error;
    }
  }

  /**
   * Clean up notifications for a user
   */
  static async cleanupTestNotifications(userId: string): Promise<void> {
    console.log(`🧹 Cleaning up notifications for user ${userId}...`);

    try {
      await prisma.notification.deleteMany({
        where: { userId },
      });

      console.log('✅ Test notifications cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning up test notifications:', error);
      throw error;
    }
  }
}

