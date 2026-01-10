import { PrismaClient, ContentPostType } from '@prisma/client';
import { MediaHelper } from './media-helper';
import * as path from 'path';
import * as fs from 'fs';
import { generateUuidV4 } from '../../../infrastructure/ids/id.strategy';

const prisma = new PrismaClient();

export interface CreatedTestData {
  userIds: string[];
  postIds: string[];
  commentIds: string[];
  threadIds: string[];
  likeIds: string[];
  shareIds: string[];
  favoriteIds: string[];
  trustRelationIds: string[];
  achievementIds: string[];
  badgeIds: string[];
  collectionIds: string[];
  eventIds: string[];
}

/**
 * Test data creator for notification tests
 * Creates real test data that triggers notifications
 */
export class TestDataCreator {
  /**
   * Create a test user with profile and avatar
   */
  static async createTestUser(
    emailPrefix: string = 'test',
    displayName?: string
  ): Promise<{ userId: string; email: string }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const email = `${emailPrefix}-${timestamp}-${randomId}@test.tipbox.co`;
    const userName = `testuser_${timestamp}_${randomId}`;
    const finalDisplayName = displayName || `Test User ${randomId}`;

    // Get avatar path and upload to MinIO
    const avatarLocalPath = MediaHelper.getTestAvatarPath();
    const avatarFilename = path.basename(avatarLocalPath);
    const avatarMediaPath = MediaHelper.getMediaPath('avatar', avatarFilename);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        status: 'ACTIVE',
        profile: {
          create: {
            displayName: finalDisplayName,
            userName,
            bio: `Test user created for notification testing at ${new Date().toISOString()}`,
          },
        },
        settings: {
          create: {
            receiveNotifications: true,
            notificationInAppEnabled: true,
            notificationPushEnabled: true,
            notificationEmailEnabled: false,
            postNotifications: true,
            trustNotifications: true,
            messageNotifications: true,
            collectionNotifications: true,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Create avatar
    if (fs.existsSync(avatarLocalPath)) {
      await prisma.userAvatar.create({
        data: {
          userId: user.id,
          imageUrl: avatarMediaPath, // Store relative path, URL will be resolved via media.config
          isActive: true,
        },
      });
    }

    return { userId: user.id, email: user.email || '' };
  }

  /**
   * Create a test post
   */
  static async createTestPost(
    userId: string,
    type: ContentPostType = ContentPostType.FREE,
    productId?: string
  ): Promise<string> {
    const postId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const postData: any = {
      id: postId,
      userId,
      type,
      title: `Test Post ${Date.now()}`,
      body: `This is a test post created for notification testing at ${new Date().toISOString()}. It contains sample content to test notification triggers.`,
      inventoryRequired: false,
      isBoosted: false,
    };

    if (productId) {
      postData.productId = productId;
    }

    const post = await prisma.contentPost.create({
      data: postData,
    });

    // Add post media if available
    try {
      const postImagePath = MediaHelper.getTestPostImagePath();
      if (fs.existsSync(postImagePath)) {
        const imageFilename = path.basename(postImagePath);
        const mediaPath = MediaHelper.getMediaPath('post', imageFilename);

        await prisma.postMedia.create({
          data: {
            postId: post.id,
            userId: userId,
            mediaUrl: mediaPath,
            orderIndex: 0,
          },
        });
      }
    } catch (error) {
      // Media is optional, continue without it
      console.warn('Could not add post media:', error);
    }

    return post.id;
  }

  /**
   * Create a test comment on a post
   */
  static async createTestComment(
    userId: string,
    postId: string,
    content?: string
  ): Promise<string> {
    const commentId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const comment = await prisma.contentComment.create({
      data: {
        id: commentId,
        userId,
        postId,
        comment: content || `Test comment created at ${new Date().toISOString()}`,
        isAnswer: false,
      },
    });

    return comment.id;
  }

  /**
   * Create a test DM thread
   */
  static async createTestThread(
    senderId: string,
    recipientId: string
  ): Promise<string> {
    const thread = await prisma.dMThread.create({
      data: {
        userOneId: senderId,
        userTwoId: recipientId,
        isActive: true,
        isSupportThread: false,
      },
    });

    return thread.id;
  }

  /**
   * Get or create a test product
   */
  static async getOrCreateTestProduct(): Promise<string> {
    // Try to get an existing product first
    const existingProduct = await prisma.product.findFirst({
      take: 1,
    });

    if (existingProduct) {
      return String(existingProduct.id);
    }

    // Create a test product if none exists
    const mainCategory = await prisma.mainCategory.findFirst();
    if (!mainCategory) {
      throw new Error('No main category found. Please run seed first.');
    }

    const subCategory = await prisma.subCategory.findFirst({
      where: { mainCategoryId: mainCategory.id },
    });

    if (!subCategory) {
      throw new Error('No sub category found. Please run seed first.');
    }

    const productGroup = await prisma.productGroup.findFirst({
      where: { subCategoryId: subCategory.id },
    });

    if (!productGroup) {
      throw new Error('No product group found. Please run seed first.');
    }

    const product = await prisma.product.create({
      data: {
        id: generateUuidV4(),
        name: `Test Product ${Date.now()}`,
        groupId: productGroup.id,
        brand: 'Test Brand',
      },
    });

    return String(product.id);
  }

  /**
   * Create test achievement
   */
  static async createTestAchievement(userId: string): Promise<string> {
    // Get or create achievement chain
    let chain = await prisma.achievementChain.findFirst();
    if (!chain) {
      chain = await prisma.achievementChain.create({
        data: {
          name: 'Test Achievement Chain',
          description: 'Test chain for notification testing',
          category: 'GENERAL',
        },
      });
    }

    // Get or create achievement goal
    let goal = await prisma.achievementGoal.findFirst({
      where: { chainId: chain.id },
    });

    if (!goal) {
      goal = await prisma.achievementGoal.create({
        data: {
          chainId: chain.id,
          title: 'Test Goal',
          requirement: 'Test goal for notification testing',
          pointsRequired: 1,
          difficulty: 'EASY',
        },
      });
    }

    // Create user achievement
    const userAchievement = await prisma.userAchievement.create({
      data: {
        userId,
        goalId: goal.id,
        progress: 100,
        completed: true,
      },
    });

    return userAchievement.id;
  }

  /**
   * Create test badge assignment
   */
  static async createTestBadge(userId: string): Promise<string> {
    // Get or create badge
    let badge = await prisma.badge.findFirst();
    if (!badge) {
      const category = await prisma.badgeCategory.findFirst();
      if (!category) {
        throw new Error('No badge category found. Please run seed first.');
      }

      badge = await prisma.badge.create({
        data: {
          name: 'Test Badge',
          description: 'Test badge for notification testing',
          categoryId: category.id,
          imageUrl: 'test-badge-icon.png',
          type: 'ACHIEVEMENT',
          rarity: 'COMMON',
        },
      });
    }

    // Assign badge to user
    const userBadge = await prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        isVisible: true,
        visibility: 'PUBLIC',
        claimed: true,
        claimedAt: new Date(),
      },
    });

    return userBadge.id;
  }
}

