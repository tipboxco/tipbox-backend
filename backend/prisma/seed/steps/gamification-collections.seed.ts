import { PrismaClient, BadgeType, BadgeRarity, AchievementDifficulty, MainAction, ContentPostType } from '@prisma/client';

export async function seedGamificationCollections(prisma: PrismaClient) {
  console.log('🎮 Seeding Gamification Collections...');

  // Get badge categories
  const categories = await prisma.badgeCategory.findMany();
  const collectionCategory = categories.find((c) => c.name === 'Collection') || categories[0];

  if (!collectionCategory) {
    console.log('⚠️  No badge categories found. Skipping collection seeding.');
    return;
  }

  // Get main categories for collection categorization
  const categoryList = await prisma.category.findMany({ where: { parentId: null }, take: 3 });

  // Collection 1: Content Creator Collection
  const contentCreatorCollection = await prisma.badgeCollection.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Content Creator Pro',
      owner: 'Tipbox Platform',
      focusSector: 'Content Creation',
      targetGroup: 'Content Creators',
      shortDescription: 'Achieve content creation milestones and become a pro',
      longDescription:
        'Complete this collection to become a verified content creator on Tipbox. Earn badges by creating quality posts, engaging with community, and building your audience.',
      bannerUrl: null,
      unlockCondition: 'Create your first post',
      completionBonus: '500 bonus tips + Verified Creator badge',
      categoryId: categoryList[0]?.id || null,
    },
  });

  // Collection 2: Community Engagement
  const engagementCollection = await prisma.badgeCollection.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Community Champion',
      owner: 'Tipbox Platform',
      focusSector: 'Social Engagement',
      targetGroup: 'Active Community Members',
      shortDescription: 'Build connections and engage with the community',
      longDescription:
        'Become a community champion by actively participating in discussions, helping others, and building meaningful connections on the platform.',
      bannerUrl: null,
      unlockCondition: 'Complete profile setup',
      completionBonus: '1000 bonus tips + Champion title',
      categoryId: categoryList[1]?.id || null,
    },
  });

  // Collection 3: Brand Partnership
  const brandCollection = await prisma.badgeCollection.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Brand Ambassador',
      owner: 'Brand Partnerships Team',
      focusSector: 'Brand Marketing',
      targetGroup: 'Brand Partners & Affiliates',
      shortDescription: 'Partner with brands and earn exclusive rewards',
      longDescription:
        'Unlock exclusive brand partnership opportunities and earn special badges by promoting products and engaging with brand content.',
      bannerUrl: null,
      unlockCondition: 'Join brand partnership program',
      completionBonus: 'Exclusive brand deals access + Premium badge',
      categoryId: categoryList[2]?.id || null,
    },
  });

  // Create Badges for Content Creator Collection
  const firstPostBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'First Post',
      description: 'Created your first post on Tipbox',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.COMMON,
      categoryId: collectionCategory.id,
      collectionId: contentCreatorCollection.id,
      boostMultiplier: 1.1,
      rewardMultiplier: 1.0,
    },
  });

  const prolificWriterBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'Prolific Writer',
      description: 'Created 50 quality posts',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.RARE,
      categoryId: collectionCategory.id,
      collectionId: contentCreatorCollection.id,
      boostMultiplier: 1.25,
      rewardMultiplier: 1.2,
    },
  });

  const contentMasterBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000003',
      name: 'Content Master',
      description: 'Created 200 posts with high engagement',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.EPIC,
      categoryId: collectionCategory.id,
      collectionId: contentCreatorCollection.id,
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
    },
  });

  // Create Badges for Community Engagement Collection
  const socialButterflyBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000004',
      name: 'Social Butterfly',
      description: 'Made 100 meaningful connections',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.COMMON,
      categoryId: collectionCategory.id,
      collectionId: engagementCollection.id,
      boostMultiplier: 1.1,
      rewardMultiplier: 1.0,
    },
  });

  const helpfulHeroBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000005',
      name: 'Helpful Hero',
      description: 'Provided 50 helpful responses to community',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.RARE,
      categoryId: collectionCategory.id,
      collectionId: engagementCollection.id,
      boostMultiplier: 1.3,
      rewardMultiplier: 1.25,
    },
  });

  // Create Badges for Brand Partnership Collection
  const brandPartnerBadge = await prisma.badge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000006',
      name: 'Brand Partner',
      description: 'Completed first brand collaboration',
      imageUrl: null,
      type: BadgeType.COLLECTION,
      rarity: BadgeRarity.COMMON,
      categoryId: collectionCategory.id,
      collectionId: brandCollection.id,
      boostMultiplier: 1.2,
      rewardMultiplier: 1.1,
    },
  });

  // Get action types
  const actionTypes = await prisma.actionType.findMany();
  const postAction = actionTypes.find((a) => a.code === 'GENERAL') || actionTypes[0];
  const commentAction = actionTypes.find((a) => a.mainAction === MainAction.COMMENT) || actionTypes[1];

  // Create Achievement Goals for Content Creator Collection
  if (postAction) {
    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000001',
        collectionId: contentCreatorCollection.id,
        title: 'First Post Achievement',
        requirement: 'Create your first post',
        mainAction: postAction.mainAction,
        actionTypeId: postAction.id,
        rewardBadgeId: firstPostBadge.id,
        pointsRequired: 1,
        difficulty: AchievementDifficulty.EASY,
      },
    });

    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000002',
        collectionId: contentCreatorCollection.id,
        title: 'Prolific Writer Achievement',
        requirement: 'Create 50 quality posts',
        mainAction: postAction.mainAction,
        actionTypeId: postAction.id,
        rewardBadgeId: prolificWriterBadge.id,
        pointsRequired: 50,
        difficulty: AchievementDifficulty.MEDIUM,
      },
    });

    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000003',
        collectionId: contentCreatorCollection.id,
        title: 'Content Master Achievement',
        requirement: 'Create 200 high-quality posts',
        mainAction: postAction.mainAction,
        actionTypeId: postAction.id,
        rewardBadgeId: contentMasterBadge.id,
        pointsRequired: 200,
        difficulty: AchievementDifficulty.HARD,
      },
    });
  }

  // Create Achievement Goals for Community Engagement Collection
  if (commentAction) {
    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000004',
        collectionId: engagementCollection.id,
        title: 'Social Butterfly Achievement',
        requirement: 'Make 100 meaningful connections',
        mainAction: commentAction.mainAction,
        actionTypeId: commentAction.id,
        rewardBadgeId: socialButterflyBadge.id,
        pointsRequired: 100,
        difficulty: AchievementDifficulty.EASY,
      },
    });

    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000005' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000005',
        collectionId: engagementCollection.id,
        title: 'Helpful Hero Achievement',
        requirement: 'Provide 50 helpful responses',
        mainAction: commentAction.mainAction,
        actionTypeId: commentAction.id,
        rewardBadgeId: helpfulHeroBadge.id,
        pointsRequired: 50,
        difficulty: AchievementDifficulty.MEDIUM,
      },
    });
  }

  // Create keyword-based Achievement Goals
  if (postAction) {
    // Keyword goal: Battery experience posts
    const batteryExpertBadge = await prisma.badge.upsert({
      where: { id: '10000000-0000-0000-0000-000000000007' },
      update: {},
      create: {
        id: '10000000-0000-0000-0000-000000000007',
        name: 'Battery Expert',
        description: 'Shared 5 posts about battery and performance topics',
        imageUrl: null,
        type: BadgeType.COLLECTION,
        rarity: BadgeRarity.RARE,
        categoryId: collectionCategory.id,
        collectionId: contentCreatorCollection.id,
        boostMultiplier: 1.2,
        rewardMultiplier: 1.1,
      },
    });

    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000006' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000006',
        collectionId: contentCreatorCollection.id,
        title: 'Battery Expert Achievement',
        requirement: 'Share 5 experience posts about battery and performance',
        mainAction: postAction.mainAction,
        actionTypeId: postAction.id,
        rewardBadgeId: batteryExpertBadge.id,
        pointsRequired: 5,
        difficulty: AchievementDifficulty.MEDIUM,
        keywords: ['battery', 'performance'],
        allowedPostTypes: [ContentPostType.EXPERIENCE],
        isPassive: false,
      },
    });

    // Passive keyword goal: Photography tracker (no badge awarded)
    const photoTrackerBadge = await prisma.badge.upsert({
      where: { id: '10000000-0000-0000-0000-000000000008' },
      update: {},
      create: {
        id: '10000000-0000-0000-0000-000000000008',
        name: 'Photography Enthusiast',
        description: 'Passive tracker for photography content',
        imageUrl: null,
        type: BadgeType.COLLECTION,
        rarity: BadgeRarity.COMMON,
        categoryId: collectionCategory.id,
        collectionId: contentCreatorCollection.id,
        boostMultiplier: null,
        rewardMultiplier: null,
      },
    });

    await prisma.achievementGoal.upsert({
      where: { id: '20000000-0000-0000-0000-000000000007' },
      update: {},
      create: {
        id: '20000000-0000-0000-0000-000000000007',
        collectionId: contentCreatorCollection.id,
        title: 'Photography Content Tracker',
        requirement: 'Track photography-related posts (passive)',
        mainAction: postAction.mainAction,
        actionTypeId: postAction.id,
        rewardBadgeId: photoTrackerBadge.id,
        pointsRequired: 10,
        difficulty: AchievementDifficulty.EASY,
        keywords: ['camera', 'photography'],
        allowedPostTypes: [],
        isPassive: true,
      },
    });
  }

  console.log('✅ Gamification Collections seeded:');
  console.log('   - 3 BadgeCollections created');
  console.log('   - 8 Badges created (including 2 keyword-based)');
  console.log('   - 7 AchievementGoals created (including 2 keyword-based, 1 passive)');
}
