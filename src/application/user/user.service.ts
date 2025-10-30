import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { UserFeedPreferencesPrismaRepository } from '../../infrastructure/repositories/user-feed-preferences-prisma.repository';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';

export class UserService {
  private readonly s3Service: S3Service;
  private readonly cacheService: CacheService;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly avatarRepo: UserAvatarPrismaRepository;
  private readonly feedPreferencesRepo: UserFeedPreferencesPrismaRepository;
  private readonly prisma: PrismaClient;

  constructor(private readonly userRepo = new UserPrismaRepository()) {
    this.s3Service = new S3Service();
    this.cacheService = CacheService.getInstance();
    this.profileRepo = new ProfilePrismaRepository();
    this.avatarRepo = new UserAvatarPrismaRepository();
    this.feedPreferencesRepo = new UserFeedPreferencesPrismaRepository();
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

    const [profile, activeAvatar, titles, postsCount, trustCount, trusterCount, userBadges] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userTitle.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' }, take: 5 }),
      this.prisma.contentPost.count({ where: { userId } }),
      this.prisma.trustRelation.count({ where: { trusterId: userId } }),
      this.prisma.trustRelation.count({ where: { trustedUserId: userId } }),
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
        posts: postsCount,
        trust: trustCount,
        truster: trusterCount,
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
        userId: { in: trustedIds },
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true },
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
      id: p.userId,
      userName: p.userName,
      titles: (titleMap.get(p.userId) || []).slice(0, 3),
      avatar: avatarMap.get(p.userId) ?? null,
      name: p.displayName,
    }));
  }

  async removeTrust(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await this.prisma.trustRelation.delete({
        where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async addTrust(userId: string, targetUserId: string): Promise<void> {
    // idempotent create
    await this.prisma.trustRelation.upsert({
      where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } },
      update: {},
      create: { trusterId: userId, trustedUserId: targetUserId },
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
        userId: { in: trusterIds },
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true },
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
      id: p.userId,
      userName: p.userName,
      titles: (titleMap.get(p.userId) || []).slice(0, 3),
      avatar: avatarMap.get(p.userId) ?? null,
      name: p.displayName,
      isTrusted: myTrustedSet.has(p.userId),
    }));
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
} 