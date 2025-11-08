import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { UserFeedPreferencesPrismaRepository } from '../../infrastructure/repositories/user-feed-preferences-prisma.repository';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { UserDevicePrismaRepository } from '../../infrastructure/repositories/user-device-prisma.repository';
import { UserPrivacySettingPrismaRepository } from '../../infrastructure/repositories/user-privacy-setting-prisma.repository';
import { NotificationCode } from '../../domain/user/notification-code.enum';
import { PrivacyCode } from '../../domain/user/privacy-code.enum';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import logger from '../../infrastructure/logger/logger';

export class UserService {
  private readonly s3Service: S3Service;
  private readonly cacheService: CacheService;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly avatarRepo: UserAvatarPrismaRepository;
  private readonly feedPreferencesRepo: UserFeedPreferencesPrismaRepository;
  private readonly settingsRepo: UserSettingsPrismaRepository;
  private readonly deviceRepo: UserDevicePrismaRepository;
  private readonly privacySettingRepo: UserPrivacySettingPrismaRepository;
  private readonly prisma: PrismaClient;

  constructor(private readonly userRepo = new UserPrismaRepository()) {
    this.s3Service = new S3Service();
    this.cacheService = CacheService.getInstance();
    this.profileRepo = new ProfilePrismaRepository();
    this.avatarRepo = new UserAvatarPrismaRepository();
    this.feedPreferencesRepo = new UserFeedPreferencesPrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.deviceRepo = new UserDevicePrismaRepository();
    this.privacySettingRepo = new UserPrivacySettingPrismaRepository();
    this.prisma = new PrismaClient();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  /**
   * Kullanıcı profilini cache'ten veya veritabanından alır (Cache-Aside Pattern)
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcı profili
   */
  async getUserProfile(userId: string): Promise<User | null> {
    const cacheKey = `user:${userId}:profile`;
    
    try {
      // Önce cache'ten kontrol et
      const cachedUser = await this.cacheService.get<User>(cacheKey);
      if (cachedUser) {
        return cachedUser;
      }

      // Cache miss - veritabanından çek
      const user = await this.userRepo.findById(userId);
      if (user) {
        // Cache'e kaydet (1 saat TTL)
        await this.cacheService.set(cacheKey, user, 3600);
      }
      
      return user;
    } catch (error) {
      // Cache hatası durumunda doğrudan veritabanından çek
      return this.userRepo.findById(userId);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  async createUser(email: string, displayName?: string): Promise<User> {
    return this.userRepo.create(email, displayName);
  }

  async createUserWithPassword(email: string, passwordHash: string, displayName?: string): Promise<User> {
    return this.userRepo.createWithPassword(email, passwordHash, displayName);
  }

  async updateUser(id: string, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    return this.userRepo.update(id, data);
  }

  /**
   * Kullanıcı profilini günceller ve cache'i temizler
   * @param userId - Kullanıcı ID'si
   * @param data - Güncellenecek veri
   * @returns Güncellenmiş kullanıcı profili
   */
  async updateUserProfile(userId: string, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    try {
      // Veritabanını güncelle
      const updatedUser = await this.userRepo.update(userId, data);
      
      if (updatedUser) {
        // Cache'i temizle (cache invalidation)
        const cacheKey = `user:${userId}:profile`;
        await this.cacheService.del(cacheKey);
      }
      
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }

  async getUserProfileCard(userId: string): Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    description: string | null;
    titles: string[];
    stats: { posts: number; trust: number; truster: number };
    badges: Array<{ imageUrl: string | null; title: string }>
  } | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) return null;

    const [profile, activeAvatar, titles, userBadges] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userTitle.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' }, take: 5 }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { claimedAt: 'desc' },
        take: 6,
      }),
    ]);

    return {
      id: user.id,
      name: profile?.displayName || user.name || 'Anonymous User',
      avatarUrl: activeAvatar?.imageUrl ?? null,
      bannerUrl: profile?.bannerUrl ?? null,
      description: profile?.bio ?? null,
      titles: titles.map(t => t.title),
      stats: {
        posts: profile?.postsCount || 0,
        trust: profile?.trustCount || 0,
        truster: profile?.trusterCount || 0,
      },
      badges: userBadges.map(ub => ({ imageUrl: ub.badge.imageUrl ?? null, title: ub.badge.name })),
    };
  }

  async listTrustedUsers(userId: string, query?: string): Promise<Array<{
    id: string;
    userName: string | null;
    titles: string[];
    avatar: string | null;
    name: string | null;
  }>> {
    const trustedRelations = await this.prisma.trustRelation.findMany({
      where: { trusterId: userId },
      select: { trustedUserId: true },
    });
    const trustedIds = trustedRelations.map(r => r.trustedUserId);
    if (trustedIds.length === 0) return [];

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: trustedIds } as any,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ] as any,
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true } as any,
    });
    const titles = await this.prisma.userTitle.findMany({
      where: { userId: { in: profiles.map(p => p.userId) } },
      orderBy: { earnedAt: 'desc' },
    });
    const avatars = await this.prisma.userAvatar.findMany({
      where: { userId: { in: profiles.map(p => p.userId) }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const titleMap = new Map<string, string[]>();
    titles.forEach(t => {
      const arr = titleMap.get(t.userId) || [];
      arr.push(t.title);
      titleMap.set(t.userId, arr);
    });
    const avatarMap = new Map<string, string>();
    avatars.forEach(a => {
      if (!avatarMap.has(a.userId)) avatarMap.set(a.userId, a.imageUrl);
    });

    return profiles.map(p => ({
      id: String(p.userId),
      userName: p.userName ?? null,
      titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
      avatar: avatarMap.get(String(p.userId)) ?? null,
      name: p.displayName,
    }));
  }

  async removeTrust(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await this.prisma.trustRelation.delete({
        where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } },
      });

      // Decrement truster's trustCount
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          trustCount: {
            increment: -1
          }
        } as any
      });

      // Decrement trusted user's trusterCount
      await this.prisma.profile.updateMany({
        where: { userId: targetUserId },
        data: {
          trusterCount: {
            increment: -1
          }
        } as any
      });

      return true;
    } catch {
      return false;
    }
  }

  async addTrust(userId: string, targetUserId: string): Promise<void> {
    // Check if relation already exists
    const existing = await this.prisma.trustRelation.findUnique({
      where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } }
    });

    if (existing) {
      return; // Already exists, no need to update counts
    }

    // idempotent create
    await this.prisma.trustRelation.upsert({
      where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } },
      update: {},
      create: { trusterId: userId, trustedUserId: targetUserId },
    });

    // Increment truster's trustCount
    await this.prisma.profile.updateMany({
      where: { userId },
      data: {
        trustCount: {
          increment: 1
        }
      } as any
    });

    // Increment trusted user's trusterCount
    await this.prisma.profile.updateMany({
      where: { userId: targetUserId },
      data: {
        trusterCount: {
          increment: 1
        }
      } as any
    });
  }

  async listTrusters(userId: string, query?: string): Promise<Array<{
    id: string;
    userName: string | null;
    titles: string[];
    avatar: string | null;
    name: string | null;
    isTrusted: boolean;
  }>> {
    const trusterRelations = await this.prisma.trustRelation.findMany({
      where: { trustedUserId: userId },
      select: { trusterId: true },
    });
    const trusterIds = trusterRelations.map(r => r.trusterId);
    if (trusterIds.length === 0) return [];

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: trusterIds } as any,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ] as any,
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true } as any,
    });

    const titles = await this.prisma.userTitle.findMany({
      where: { userId: { in: profiles.map(p => p.userId) } },
      orderBy: { earnedAt: 'desc' },
    });
    const avatars = await this.prisma.userAvatar.findMany({
      where: { userId: { in: profiles.map(p => p.userId) }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // who current user trusts to compute isTrusted
    const myTrusted = await this.prisma.trustRelation.findMany({ where: { trusterId: userId } });
    const myTrustedSet = new Set(myTrusted.map(r => r.trustedUserId));

    const titleMap = new Map<string, string[]>();
    titles.forEach(t => {
      const arr = titleMap.get(t.userId) || [];
      arr.push(t.title);
      titleMap.set(t.userId, arr);
    });
    const avatarMap = new Map<string, string>();
    avatars.forEach(a => {
      if (!avatarMap.has(a.userId)) avatarMap.set(a.userId, a.imageUrl);
    });

    return profiles.map(p => ({
      id: String(p.userId),
      userName: p.userName ?? null,
      titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
      avatar: avatarMap.get(String(p.userId)) ?? null,
      name: p.displayName,
      isTrusted: myTrustedSet.has(String(p.userId)),
    }));
  }

  async blockUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserBlock
    await (this.prisma as any).userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      update: {},
      create: { blockerId: userId, blockedUserId: targetUserId },
    });
  }

  async unblockUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await (this.prisma as any).userBlock.delete({
        where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async muteUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserMute
    await (this.prisma as any).userMute.upsert({
      where: { muterId_mutedUserId: { muterId: userId, mutedUserId: targetUserId } },
      update: {},
      create: { muterId: userId, mutedUserId: targetUserId },
    });
  }

  async unmuteUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await (this.prisma as any).userMute.delete({
        where: { muterId_mutedUserId: { muterId: userId, mutedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async listAchievementBadges(userId: string, query?: string): Promise<Array<{
    id: string;
    image: string | null;
    title: string;
    rarity: 'Usual' | 'Rare';
    isClaimed: boolean;
    nftAddress: string | null;
    totalEarned: number;
    earnedDate: Date | null;
    tasks: Array<{ id: string; title: string; type: 'Yorum Yap' | 'Beğeni' | 'Paylaşma' }>;
  }>> {
    const where: any = {
      userId,
      badge: {
        type: 'ACHIEVEMENT',
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        } : {}),
      },
    };

    const userBadges = await this.prisma.userBadge.findMany({
      where,
      include: {
        badge: {
          include: {
            achievementGoals: {
              include: { chain: true },
            },
          },
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    const rarityMap: Record<string, 'Usual' | 'Rare'> = {
      COMMON: 'Usual',
      RARE: 'Rare',
      EPIC: 'Rare', // EPIC de Rare olarak göster
    };

    return userBadges.map(ub=> {
      const badge = (ub as any).badge;
      const goals = (badge?.achievementGoals || []) as any[];
      // Task type'ları goal title/requirement'dan çıkar (basitleştirilmiş)
      const tasks = goals.map(goal => ({
        id: goal.id,
        title: goal.title,
        type: (goal.requirement?.toLowerCase().includes('yorum') ? 'Yorum Yap' :
               goal.requirement?.toLowerCase().includes('beğen') ? 'Beğeni' :
               goal.requirement?.toLowerCase().includes('paylaş') ? 'Paylaşma' : 'Yorum Yap') as 'Yorum Yap' | 'Beğeni' | 'Paylaşma',
      }));

      return {
        id: String(badge?.id || ''),
        image: badge?.imageUrl ?? null,
        title: badge?.name || '',
        rarity: rarityMap[badge?.rarity || 'COMMON'] || 'Usual',
        isClaimed: ub.claimed,
        nftAddress: null, // şimdilik null
        totalEarned: ub.claimed ? 1 : 0,
        earnedDate: ub.claimedAt,
        tasks: tasks.map(t => ({ ...t, id: String(t.id) })),
      };
    });
  }

  // Profile Feed EP'leri için yardımcı fonksiyonlar
  private async getPostStats(postId: string) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        likesCount: true,
        commentsCount: true,
        favoritesCount: true,
        viewsCount: true
      } as any
    });

    return {
      likes: post?.likesCount || 0,
      comments: post?.commentsCount || 0,
      shares: 0,
      bookmarks: post?.favoritesCount || 0
    };
  }

  private async getUserBase(userId: string) {
    const [profile, avatar, title] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true } }),
      this.prisma.userTitle.findFirst({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);
    return {
      id: userId,
      name: profile?.displayName || 'Anonymous',
      title: title?.title || '',
      avatarUrl: avatar?.imageUrl ?? '',
    };
  }

  private async getProductBase(productId: string | null) {
    if (!productId) return null;
    const product = await this.prisma.product.findUnique({ where: { id: productId } as any, include: { group: true } as any });
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || (product as any).group?.name || '',
      image: null, // Product'ın image'ı yoksa null
    };
  }

  async getUserPosts(userId: string): Promise<any[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: 'FREE' } as any,
      include: { product: true, likes: true, comments: true, favorites: true } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(post.id);
        const product = await this.getProductBase(post.productId);
        return {
          id: String(post.id),
          type: 'post' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          product,
          content: post.body,
          images: [], // TODO: InventoryMedia'dan çekilecek
        };
      })
    );
    return results;
  }

  async getUserReviews(userId: string): Promise<any[]> {
    // Reviews = ProductExperience'lar (Inventory + ProductExperience)
    const inventories = await this.prisma.inventory.findMany({
      where: { userId } as any,
      include: {
        product: true,
        productExperiences: true,
        media: true,
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    const results: any[] = [];
    for (const inv of inventories) {
      const experiences = (inv as any).productExperiences || [];
      for (const exp of experiences) {
        const postIds = await this.prisma.contentPost.findMany({ 
          where: { productId: String(inv.productId) } as any, 
          select: { id: true } 
        }).then((ps) => ps.map((p) => String(p.id)));
        const tags = await this.prisma.contentPostTag.findMany({
          where: { postId: { in: postIds } } as any,
        });
        const invProduct = (inv as any).product;
        const invMedia = (inv as any).media || [];
        results.push({
          id: String(exp.id),
          type: 'feed' as const,
          user: userBase,
          stats: await this.getPostStats(''), // TODO: Review için post ID gerekli
          createdAt: exp.createdAt.toISOString(),
          product: {
            id: String(invProduct?.id || ''),
            name: invProduct?.name || '',
            subName: invProduct?.brand || '',
            image: null,
          },
          content: [
            {
              title: 'Experience' as const,
              content: exp.experienceText,
              rating: 0, // TODO: Rating modeli gerekli
            },
          ],
          tags: tags.map((t) => t.tag),
          images: invMedia.filter((m: any) => m.type === 'IMAGE').map((m: any) => m.mediaUrl),
        });
      }
    }
    return results;
  }

  async getUserBenchmarks(userId: string): Promise<any[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: 'COMPARE' } as any,
      include: { comparison: { include: { product1: true, product2: true } } } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    const inventories = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    const results = await Promise.all(
      posts
        .filter((p) => (p as any).comparison)
        .map(async (post) => {
          const comp = (post as any).comparison!;
          const stats = await this.getPostStats(String(post.id));
          return {
            id: String(post.id),
            type: 'benchmark' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            products: [
              {
                ...(await this.getProductBase(String(comp.product1Id)))!,
                isOwned: ownedSet.has(String(comp.product1Id)),
                choice: false, // TODO: Comparison score'dan çıkarılacak
              },
              {
                ...(await this.getProductBase(String(comp.product2Id)))!,
                isOwned: ownedSet.has(String(comp.product2Id)),
                choice: false,
              },
            ],
            content: post.body,
          };
        })
    );
    return results;
  }

  async getUserTips(userId: string): Promise<any[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: 'TIPS' } as any,
      include: { tip: true, product: true } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(String(post.id));
        const product = await this.getProductBase(post.productId ? String(post.productId) : null);
        const tags = await this.prisma.postTag.findMany({ where: { postId: String(post.id) } as any });
        return {
          id: String(post.id),
          type: 'tipsAndTricks' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          product,
          content: post.body,
          tag: tags[0]?.tag || '',
          images: [], // TODO: InventoryMedia
        };
      })
    );
    return results;
  }

  async getUserReplies(userId: string): Promise<any[]> {
    const comments = await this.prisma.contentComment.findMany({
      where: { userId } as any,
      include: { post: { include: { product: true } } } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    const results = await Promise.all(
      comments.map(async (comment) => {
        const stats = await this.getPostStats(String(comment.postId));
        const commentPost = (comment as any).post;
        const product = await this.getProductBase(commentPost?.productId ? String(commentPost.productId) : null);
        return {
          id: String(comment.id),
          type: 'feed' as const,
          user: userBase,
          stats,
          createdAt: comment.createdAt.toISOString(),
          product,
          content: comment.comment,
          isBoosted: false, // TODO: Post'tan alınacak
          images: [], // TODO
        };
      })
    );
    return results;
  }

  async getUserLadderBadges(userId: string): Promise<any[]> {
    // Ladder = kazanılmış badge'ler (sıralama önemli)
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId, claimed: true } as any,
      include: { badge: true } as any,
      orderBy: { claimedAt: 'asc' }, // Ladder sırasına göre
    });

    const rarityMap: Record<string, 'Usual' | 'Rare'> = {
      COMMON: 'Usual',
      RARE: 'Rare',
      EPIC: 'Rare',
    };

    return userBadges.map((ub) => {
      const badge = (ub as any).badge;
      return {
        id: String(badge?.id || ''),
        image: badge?.imageUrl ?? null,
        title: badge?.name || '',
        rarity: rarityMap[badge?.rarity || 'COMMON'] || 'Usual',
        isClaimed: ub.claimed,
        nftAddress: null,
        totalEarned: 1,
        earnedDate: ub.claimedAt?.toISOString() ?? null,
      };
    });
  }

  async getUserBookmarks(userId: string): Promise<any[]> {
    // Bookmarks = Kullanıcının favorite ettiği post'lar (tüm tiplerde)
    const favorites = await this.prisma.contentFavorite.findMany({
      where: { userId } as any,
      include: {
        post: {
          include: {
            product: true,
            comparison: { include: { product1: true, product2: true } } as any,
            tip: true,
            question: true,
          },
        },
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    // Post'lardaki unique userId'leri topla
    const postUserIds = [...new Set(favorites.map((f) => String((f as any).post?.userId)).filter(Boolean))];

    // User bilgilerini toplu çek
    const users = await Promise.all(
      postUserIds.map(async (uid) => {
        const [profile, avatar, title] = await Promise.all([
          this.profileRepo.findByUserId(uid as unknown as string), // uid tek başına hata veriyor
          this.prisma.userAvatar.findFirst({ where: { userId: uid, isActive: true } as any }),
          this.prisma.userTitle.findFirst({ where: { userId: uid } as any, orderBy: { earnedAt: 'desc' } }),
        ]);
        return {
          userId: uid,
          userBase: {
            id: uid,
            name: profile?.displayName || 'Anonymous',
            title: title?.title || '',
            avatarUrl: avatar?.imageUrl ?? '',
          },
        };
      })
    );

    const userBaseMap = new Map(users.map((u) => [u.userId, u.userBase]));

    // User'ın sahip olduğu product'ları çek (benchmark için)
    const inventories = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    const results: any[] = [];

    for (const fav of favorites) {
      const post = (fav as any).post;
      if (!post) continue;

      const postUserId = String(post.userId);
      const userBase = userBaseMap.get(postUserId) || {
        id: postUserId,
        name: 'Anonymous',
        title: '',
        avatarUrl: '',
      };

      const stats = await this.getPostStats(String(post.id));
      const product = await this.getProductBase(post.productId ? String(post.productId) : null);

      // Post type'ına göre formatla
      switch (post.type) {
        case 'FREE': {
          // FREE -> "post" veya "feed" tipi
          results.push({
            id: String(post.id),
            type: 'post' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            product,
            content: post.body,
            images: [], // TODO: InventoryMedia
          });
          break;
        }

        case 'COMPARE': {
          // COMPARE -> "benchmark" tipi
          const comp = (post as any).comparison;
          if (!comp) break;

          results.push({
            id: String(post.id),
            type: 'benchmark' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            products: [
              {
                ...(await this.getProductBase(String(comp.product1Id)))!,
                isOwned: ownedSet.has(String(comp.product1Id)),
                choice: false, // TODO: Comparison score'dan çıkarılacak
              },
              {
                ...(await this.getProductBase(String(comp.product2Id)))!,
                isOwned: ownedSet.has(String(comp.product2Id)),
                choice: false,
              },
            ],
            content: post.body,
          });
          break;
        }

        case 'TIPS': {
          // TIPS -> "tipsAndTricks" tipi
          const tags = await this.prisma.postTag.findMany({ where: { postId: String(post.id) } as any });
          results.push({
            id: String(post.id),
            type: 'tipsAndTricks' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            product,
            content: post.body,
            tag: tags[0]?.tag || '',
            images: [], // TODO: InventoryMedia
          });
          break;
        }

        case 'QUESTION': {
          // QUESTION -> "question" tipi
          const question = (post as any).question;
          results.push({
            id: String(post.id),
            type: 'question' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            product,
            content: post.body,
            expectedAnswerFormat: question?.expectedAnswerFormat || 'short',
            images: [], // TODO
          });
          break;
        }

        default:
          // Unknown type -> "feed" olarak döndür
          results.push({
            id: String(post.id),
            type: 'feed' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            product,
            content: post.body,
            images: [],
          });
      }
    }

    return results;
  }

  /**
   * Batch endpoint: Profile card + tab verilerini tek istekte döner
   * Performance optimizasyonu için: İlk ekran için gerekli tüm verileri tek seferde getirir
   */
  async getUserProfileData(
    userId: string,
    options?: {
      includeProfileCard?: boolean;
      includeTabs?: Array<'feed' | 'reviews' | 'benchmarks' | 'tips' | 'replies' | 'ladder'>;
      limit?: number;
    }
  ): Promise<{
    profileCard: any | null;
    tabs: {
      feed?: any[];
      reviews?: any[];
      benchmarks?: any[];
      tips?: any[];
      replies?: any[];
      ladder?: any[];
    };
    meta: {
      cached: boolean;
      timestamp: string;
    };
  }> {
    const {
      includeProfileCard = true,
      includeTabs = ['feed'], // Default: sadece feed tab
      limit = 20,
    } = options || {};

    // Cache check
    const cacheKey = `user:${userId}:profile:${includeTabs.join(',')}`;
    try {
      const cached = (await this.cacheService.get(cacheKey)) as any;
      if (cached && cached.profileCard !== undefined && cached.tabs !== undefined) {
        return {
          ...cached,
          meta: { ...(cached.meta || {}), cached: true, timestamp: cached.meta?.timestamp || new Date().toISOString() },
        };
      }
    } catch {
      // Cache error - continue without cache
    }

    // Parallel data fetching
    const promises: Promise<any>[] = [];

    if (includeProfileCard) {
      promises.push(this.getUserProfileCard(userId));
    }

    const tabPromises: Promise<any[]>[] = [];
    if (includeTabs.includes('feed')) {
      tabPromises.push(this.getUserPosts(userId));
    }
    if (includeTabs.includes('reviews')) {
      tabPromises.push(this.getUserReviews(userId));
    }
    if (includeTabs.includes('benchmarks')) {
      tabPromises.push(this.getUserBenchmarks(userId));
    }
    if (includeTabs.includes('tips')) {
      tabPromises.push(this.getUserTips(userId));
    }
    if (includeTabs.includes('replies')) {
      tabPromises.push(this.getUserReplies(userId));
    }
    if (includeTabs.includes('ladder')) {
      tabPromises.push(this.getUserLadderBadges(userId));
    }

    promises.push(...tabPromises);

    const results = await Promise.all(promises);

    let tabIndex = includeProfileCard ? 1 : 0;
    const response = {
      profileCard: includeProfileCard ? results[0] : null,
      tabs: {
        feed: includeTabs.includes('feed')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
        reviews: includeTabs.includes('reviews')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
        benchmarks: includeTabs.includes('benchmarks')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
        tips: includeTabs.includes('tips')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
        replies: includeTabs.includes('replies')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
        ladder: includeTabs.includes('ladder')
          ? (results[tabIndex++] || []).slice(0, limit)
          : undefined,
      },
      meta: {
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache for 5 minutes (profileCard için daha uzun, tab verileri için kısa)
    try {
      await this.cacheService.set(cacheKey, response, 300);
    } catch {
      // Cache error - continue
    }

    return response;
  }

  /**
   * Kullanıcı profil fotoğrafı yükleme için pre-signed URL oluşturur
   * @param userId - Kullanıcı ID'si
   * @param fileName - Yüklenecek dosya adı
   * @param fileType - Dosya tipi (MIME type)
   * @returns Pre-signed URL ve dosya bilgileri
   */
  async updateUserProfilePicture(userId: string, fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    fileUrl: string;
  }> {
    // Dosya adını kullanıcı ID'si ile prefix'leyerek benzersiz hale getir
    const uniqueFileName = `profile-pictures/${userId}/${fileName}`;
    
    // Pre-signed URL oluştur
    const uploadUrl = await this.s3Service.generatePresignedUploadUrl(uniqueFileName, fileType);
    
    // Dosya yüklendikten sonra erişilecek nihai URL
    // Format: ${S3_ENDPOINT}/${S3_BUCKET_NAME}/${fileName}
    const fileUrl = this.s3Service.getFileUrl(uniqueFileName);
    
    return {
      uploadUrl,
      fileUrl,
    };
  }

  /**
   * Kullanıcı profilini tamamlar (Set Up Profile)
   * @param userId - Kullanıcı ID'si
   * @param data - Profil verileri
   * @returns Güncellenmiş kullanıcı profili
   */
  async setupProfile(
    userId: string,
    data: {
      fullName: string;
      userName: string;
      avatarUrl?: string;
      selectedCategories?: Array<{
        categoryId: string;
        subCategoryIds: string[];
      }>;
    }
  ): Promise<User> {
    // Kullanıcının var olup olmadığını kontrol et
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Email doğrulaması kontrolü
    if (!user.emailVerified) {
      throw new Error('Email doğrulanmamış. Lütfen önce email adresinizi doğrulayın.');
    }

    // Username benzersizlik kontrolü
    const existingProfile = await this.profileRepo.findByUserName(data.userName);
    if (existingProfile && existingProfile.userId !== userId) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Transaction içinde tüm işlemleri gerçekleştir
    return await this.prisma.$transaction(async (tx) => {
      // Profile'ı güncelle veya oluştur
      const existingProfile = await tx.profile.findUnique({ where: { userId } });
      
      if (existingProfile) {
        await tx.profile.update({
          where: { userId },
          data: {
            displayName: data.fullName,
            userName: data.userName,
          },
        });
      } else {
        await tx.profile.create({
          data: {
            userId,
            displayName: data.fullName,
            userName: data.userName,
          },
        });
      }

      // Avatar varsa kaydet
      if (data.avatarUrl) {
        // Önceki aktif avatar'ı pasif yap
        await tx.userAvatar.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });

        // Yeni avatar'ı aktif olarak kaydet
        await tx.userAvatar.create({
          data: {
            userId,
            imageUrl: data.avatarUrl,
            isActive: true,
          },
        });
      }

      // Kategori tercihlerini kaydet
      if (data.selectedCategories && data.selectedCategories.length > 0) {
        const categoriesJson = JSON.stringify(data.selectedCategories);
        
        const existingPreferences = await tx.userFeedPreferences.findUnique({
          where: { userId },
        });

        if (existingPreferences) {
          await tx.userFeedPreferences.update({
            where: { userId },
            data: {
              preferredCategories: categoriesJson,
            },
          });
        } else {
          await tx.userFeedPreferences.create({
            data: {
              userId,
              preferredCategories: categoriesJson,
            },
          });
        }
      }

      // Kullanıcı durumunu ACTIVE yap
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
        },
      });

      // Cache'i temizle
      const cacheKey = `user:${userId}:profile`;
      await this.cacheService.del(cacheKey);

      // Güncellenmiş kullanıcıyı döndür
      const updatedUser = await this.userRepo.findById(userId);
      if (!updatedUser) {
        throw new Error('Kullanıcı güncellenemedi');
      }

      logger.info({
        message: 'User profile setup completed',
        userId,
        userName: data.userName,
      });

      return updatedUser;
    });
  }

  // ===== SETTINGS METHODS =====

  /**
   * Change Password - Kullanıcının şifresini değiştirir
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user || !user.passwordHash) {
        return {
          success: false,
          message: 'User not found or password not set',
        };
      }

      // Mevcut şifreyi kontrol et
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Yeni şifre validasyonu
      if (!newPassword || newPassword.length < 6) {
        return {
          success: false,
          message: 'New password must be at least 6 characters',
        };
      }

      // Yeni şifreyi hash'le ve güncelle
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await this.userRepo.update(userId, { passwordHash: newPasswordHash });

      logger.info({
        message: 'Password changed successfully',
        userId,
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error changing password',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to change password',
      };
    }
  }

  /**
   * Get Notification Settings - Kullanıcının bildirim ayarlarını getirir
   */
  async getNotificationSettings(userId: string): Promise<
    Array<{
      notificationCode: NotificationCode;
      value: boolean;
    }>
  > {
    let settings = await this.settingsRepo.findByUserId(userId);
    if (!settings) {
      // Default settings oluştur
      settings = await this.settingsRepo.create(userId);
    }

    return [
      {
        notificationCode: NotificationCode.EMAIL,
        value: settings.getNotificationValue(NotificationCode.EMAIL),
      },
      {
        notificationCode: NotificationCode.PUSH,
        value: settings.getNotificationValue(NotificationCode.PUSH),
      },
      {
        notificationCode: NotificationCode.IN_APP,
        value: settings.getNotificationValue(NotificationCode.IN_APP),
      },
    ];
  }

  /**
   * Update Notification Settings - Kullanıcının bildirim ayarlarını günceller
   */
  async updateNotificationSettings(
    userId: string,
    settings: Array<{
      notificationCode: NotificationCode;
      value: boolean;
    }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      let userSettings = await this.settingsRepo.findByUserId(userId);
      if (!userSettings) {
        userSettings = await this.settingsRepo.create(userId);
      }

      const updateData: {
        notificationEmailEnabled?: boolean;
        notificationPushEnabled?: boolean;
        notificationInAppEnabled?: boolean;
      } = {};

      for (const setting of settings) {
        switch (setting.notificationCode) {
          case NotificationCode.EMAIL:
            updateData.notificationEmailEnabled = setting.value;
            break;
          case NotificationCode.PUSH:
            updateData.notificationPushEnabled = setting.value;
            break;
          case NotificationCode.IN_APP:
            updateData.notificationInAppEnabled = setting.value;
            break;
        }
      }

      await this.settingsRepo.updateByUserId(userId, updateData);

      logger.info({
        message: 'Notification settings updated',
        userId,
      });

      return {
        success: true,
        message: 'Notification settings updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating notification settings',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update notification settings',
      };
    }
  }

  /**
   * Get Privacy Settings - Kullanıcının gizlilik ayarlarını getirir
   */
  async getPrivacySettings(userId: string): Promise<
    Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }>
  > {
    const settings = await this.privacySettingRepo.findByUserId(userId);

    // Default değerler
    const defaultValues: Record<PrivacyCode, string> = {
      [PrivacyCode.NFT_BADGE_COLLECTIONS]: 'trust-only',
      [PrivacyCode.TRUST_TRUSTER_LIST]: 'everyone',
      [PrivacyCode.ONE_ON_ONE_SUPPORT]: 'everyone',
    };

    const result: Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }> = [];

    for (const privacyCode of Object.values(PrivacyCode) as PrivacyCode[]) {
      const setting = settings.find((s: any) => s.privacyCode === privacyCode);
      result.push({
        privacyCode,
        selectedValue: setting?.selectedValue || defaultValues[privacyCode],
      });
    }

    return result;
  }

  /**
   * Update Privacy Settings - Kullanıcının gizlilik ayarlarını günceller
   */
  async updatePrivacySettings(
    userId: string,
    settings: Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      for (const setting of settings) {
        await this.privacySettingRepo.upsert(
          userId,
          setting.privacyCode,
          setting.selectedValue
        );
      }

      logger.info({
        message: 'Privacy settings updated',
        userId,
      });

      return {
        success: true,
        message: 'Privacy settings updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating privacy settings',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update privacy settings',
      };
    }
  }

  /**
   * Get Support Session Price - Destek oturumu fiyatını getirir
   */
  async getSupportSessionPrice(userId: string): Promise<number | null> {
    const settings = await this.settingsRepo.findByUserId(userId);
    return settings?.getSupportSessionPrice() || null;
  }

  /**
   * Update Support Session Price - Destek oturumu fiyatını günceller
   */
  async updateSupportSessionPrice(
    userId: string,
    price: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Minimum 50 TIPS kontrolü
      if (price < 50) {
        return {
          success: false,
          message: 'Minimum 50 TIPS can be set',
        };
      }

      let settings = await this.settingsRepo.findByUserId(userId);
      if (!settings) {
        settings = await this.settingsRepo.create(userId);
      }

      // 10 günde bir değiştirilebilir kontrolü
      if (!settings.canUpdateSupportSessionPrice()) {
        return {
          success: false,
          message: 'The amount can be changed once every 10 days',
        };
      }

      await this.settingsRepo.updateByUserId(userId, {
        supportSessionPrice: price,
        supportSessionPriceUpdatedAt: new Date(),
      });

      logger.info({
        message: 'Support session price updated',
        userId,
        price,
      });

      return {
        success: true,
        message: 'Support session price updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating support session price',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update support session price',
      };
    }
  }

  /**
   * Get Connected Devices - Bağlı cihazları getirir
   */
  async getConnectedDevices(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      location: string | null;
      date: string;
      isActive: boolean;
    }>
  > {
    const devices = await this.deviceRepo.findByUserId(userId);
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      location: device.location,
      date: device.getDisplayDate().toISOString(),
      isActive: device.isActive,
    }));
  }

  /**
   * Remove Device - Bağlı cihazı listeden kaldırır
   */
  async removeDevice(
    userId: string,
    deviceId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const device = await this.deviceRepo.findById(deviceId);
      if (!device || device.userId !== userId) {
        return {
          success: false,
          message: 'Device not found',
        };
      }

      await this.deviceRepo.delete(deviceId);

      logger.info({
        message: 'Device removed',
        userId,
        deviceId,
      });

      return {
        success: true,
        message: 'Device removed successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error removing device',
        userId,
        deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to remove device',
      };
    }
  }

  /**
   * Remove All Devices - Tüm cihazları listeden kaldırır
   */
  async removeAllDevices(userId: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const count = await this.deviceRepo.deleteByUserId(userId);

      logger.info({
        message: 'All devices removed',
        userId,
        count,
      });

      return {
        success: true,
        message: 'All devices removed successfully',
        count,
      };
    } catch (error) {
      logger.error({
        message: 'Error removing all devices',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to remove all devices',
        count: 0,
      };
    }
  }
} 