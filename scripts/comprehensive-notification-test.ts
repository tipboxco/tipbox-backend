/**
 * Kapsamlı Bildirim Sistemi Test Script
 * 
 * Ömer kullanıcısına tüm bildirim tiplerini gerçekçi senaryolarla gönderir.
 * Terminal üzerinden endpoint'leri kullanarak gerçek kullanıcı davranışlarını simüle eder.
 * 
 * Kullanım:
 *   docker compose exec backend npx ts-node scripts/comprehensive-notification-test.ts
 */

import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import { generateIdForModel } from '../src/infrastructure/ids/id.strategy';
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_PASSWORD = 'password123';

const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const OMER_EMAIL = 'omer@tipbox.co';

// Test kullanıcıları
const TEST_USERS = {
  alice: {
    email: 'alice.notification.test@tipbox.co',
    displayName: 'Alice',
    userName: 'alice_test',
    bio: 'Post interaction test kullanıcısı',
  },
  bob: {
    email: 'bob.notification.test@tipbox.co',
    displayName: 'Bob',
    userName: 'bob_test',
    bio: 'Trust ve share test kullanıcısı',
  },
  charlie: {
    email: 'charlie.notification.test@tipbox.co',
    displayName: 'Charlie',
    userName: 'charlie_test',
    bio: 'Mesajlaşma ve trust test kullanıcısı',
  },
  diana: {
    email: 'diana.notification.test@tipbox.co',
    displayName: 'Diana',
    userName: 'diana_test',
    bio: 'Expert request test kullanıcısı',
  },
  eve: {
    email: 'eve.notification.test@tipbox.co',
    displayName: 'Eve',
    userName: 'eve_test',
    bio: 'Gamification ve comment test kullanıcısı',
  },
};

interface UserData {
  id: string;
  email: string;
  token: string;
  profileId?: string;
}

interface TestResult {
  scenario: string;
  notificationType: NotificationType;
  success: boolean;
  error?: string;
  notificationId?: string;
}

class ComprehensiveNotificationTester {
  private prisma: ReturnType<typeof getPrisma>;
  private api: AxiosInstance;
  private omer: UserData | null = null;
  private testUsers: Map<string, UserData> = new Map();
  private results: TestResult[] = [];
  private omerPosts: string[] = [];
  private omerComments: string[] = [];

  constructor() {
    this.prisma = getPrisma();
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warn: '⚠️',
    }[level];
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  /**
   * Kullanıcı oluştur veya bul
   */
  private async createOrGetUser(
    email: string,
    displayName: string,
    userName: string,
    bio?: string
  ): Promise<{ id: string; email: string }> {
    // Önce mevcut kullanıcıyı kontrol et
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user) {
      // Profile varsa güncelle, yoksa oluştur
      if (!user.profile) {
        await this.prisma.profile.create({
          data: {
            userId: user.id,
            displayName,
            userName,
            bio: bio || '',
            bannerUrl: null,
          },
        });
      } else {
        await this.prisma.profile.update({
          where: { userId: user.id },
          data: {
            displayName,
            userName,
            bio: bio || user.profile.bio,
          },
        });
      }

      return { id: user.id, email: user.email || email };
    }

    // Yeni kullanıcı oluştur
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
        profile: {
          create: {
            displayName,
            userName,
            bio: bio || '',
            bannerUrl: null,
          },
        },
      },
      include: { profile: true },
    });

    // Avatar oluştur (opsiyonel)
    await this.prisma.userAvatar.create({
      data: {
        userId: user.id,
        imageUrl: '',
        isActive: true,
      },
    }).catch(() => {}); // Ignore if fails

    return { id: user.id, email: user.email || email };
  }

  /**
   * Kullanıcı ile login ol ve token al
   */
  private async loginUser(email: string, password: string = DEFAULT_PASSWORD): Promise<string> {
    try {
      const response = await this.api.post('/auth/login', {
        email,
        password,
      });

      return response.data.token;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Kullanıcı yoksa oluştur ve tekrar dene
        throw new Error(`Login failed for ${email}. User may need to be created first.`);
      }
      throw error;
    }
  }

  /**
   * Ömer kullanıcısını hazırla
   */
  private async setupOmer(): Promise<void> {
    this.log('Ömer kullanıcısı hazırlanıyor...');
    
    let omerUser = await this.prisma.user.findUnique({
      where: { id: OMER_USER_ID },
    });

    if (!omerUser) {
      // Email ile dene
      omerUser = await this.prisma.user.findUnique({
        where: { email: OMER_EMAIL },
      });
    }

    if (!omerUser) {
      // Yeni oluştur
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      omerUser = await this.prisma.user.create({
        data: {
          id: OMER_USER_ID,
          email: OMER_EMAIL,
          passwordHash,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      // Profile oluştur
      await this.prisma.profile.create({
        data: {
          userId: omerUser.id,
          displayName: 'Ömer Faruk',
          userName: 'omerfaruk',
          bio: 'Test kullanıcısı - Bildirim testleri için',
          bannerUrl: null,
        },
      });
    }

    const token = await this.loginUser(OMER_EMAIL);
    this.omer = {
      id: omerUser.id,
      email: omerUser.email || OMER_EMAIL,
      token,
    };

    this.log(`Ömer hazır - ID: ${this.omer.id}`, 'success');
  }

  /**
   * Test kullanıcılarını hazırla
   */
  private async setupTestUsers(): Promise<void> {
    this.log('Test kullanıcıları hazırlanıyor...');

    for (const [key, userData] of Object.entries(TEST_USERS)) {
      try {
        const user = await this.createOrGetUser(
          userData.email,
          userData.displayName,
          userData.userName,
          userData.bio
        );

        const token = await this.loginUser(userData.email);
        this.testUsers.set(key, {
          id: user.id,
          email: user.email,
          token,
        });

        this.log(`${userData.displayName} hazır - ID: ${user.id}`, 'success');
      } catch (error: any) {
        this.log(`${userData.displayName} hazırlanırken hata: ${error.message}`, 'error');
        throw error;
      }
    }
  }

  /**
   * Ömer için test post'ları hazırla (önce mevcut post'ları kullan, yoksa yeni oluştur)
   */
  private async createOmerPosts(): Promise<void> {
    if (!this.omer) throw new Error('Ömer kullanıcısı hazır değil');

    this.log('Ömer için test post\'ları hazırlanıyor...');

    // ÖNCE mevcut post'ları kontrol et
    const existingPosts = await (this.prisma as any).contentPost.findMany({
      where: { userId: this.omer.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    if (existingPosts.length >= 3) {
      // Yeterli mevcut post var, onları kullan
      this.omerPosts = existingPosts.map((p: any) => p.id);
      this.log(`${this.omerPosts.length} mevcut post kullanılacak`, 'success');
      existingPosts.forEach((p: any, index: number) => {
        this.log(`  ${index + 1}. ${p.title} (${p.id})`, 'info');
      });
      return;
    }

    // Yeterli post yoksa yeni oluştur
    this.log(`Sadece ${existingPosts.length} mevcut post var, yeni post'lar oluşturuluyor...`, 'info');
    
    // Mevcut post'ları da ekle
    this.omerPosts = existingPosts.map((p: any) => p.id);

    // Kategorileri al
    const categories = await (this.prisma as any).mainCategory.findMany({ take: 1 });
    const subCategories = await (this.prisma as any).subCategory.findMany({ take: 1 });
    
    if (categories.length === 0 || subCategories.length === 0) {
      this.log('Kategori bulunamadı, mevcut post\'lar kullanılacak', 'warn');
      return;
    }

    const mainCategoryId = categories[0].id;
    const subCategoryId = subCategories[0].id;

    // Eksik kadar post oluştur (toplam 5 olacak şekilde)
    const neededPosts = 5 - this.omerPosts.length;
    const postTitles = [
      'Test Post 1 - Bildirim Testi',
      'Test Post 2 - Like Testi',
      'Test Post 3 - Comment Testi',
      'Test Post 4 - Share Testi',
      'Test Post 5 - Favorite Testi',
    ];

    for (let i = 0; i < neededPosts && i < postTitles.length; i++) {
      try {
        const post = await (this.prisma as any).contentPost.create({
          data: {
            id: generateIdForModel('ContentPost'),
            userId: this.omer.id,
            type: 'FREE',
            title: postTitles[i],
            body: `${postTitles[i]} - Bu post bildirim testleri için oluşturulmuştur.`,
            mainCategoryId,
            subCategoryId,
            inventoryRequired: false,
            isBoosted: false,
          },
        });
        this.omerPosts.push(post.id);
        this.log(`Yeni post oluşturuldu: ${post.id}`, 'success');
      } catch (error: any) {
        this.log(`Post oluşturulurken hata: ${error.message}`, 'warn');
      }
    }

    if (this.omerPosts.length === 0) {
      this.log('⚠️ Hiç post bulunamadı ve oluşturulamadı!', 'error');
    } else {
      this.log(`Toplam ${this.omerPosts.length} post hazır`, 'success');
    }
  }

  /**
   * Ömer için test comment'leri hazırla (önce mevcut comment'leri kullan, yoksa yeni oluştur)
   */
  private async createOmerComments(): Promise<void> {
    if (!this.omer || this.omerPosts.length === 0) {
      this.log('Comment hazırlamak için post gerekli', 'warn');
      return;
    }

    this.log('Ömer için test comment\'leri hazırlanıyor...');

    // ÖNCE mevcut comment'leri kontrol et (Ömer'in post'larına yapılmış)
    const existingComments = await (this.prisma as any).contentComment.findMany({
      where: { 
        userId: this.omer.id,
        postId: { in: this.omerPosts },
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    if (existingComments.length >= 2) {
      // Yeterli mevcut comment var, onları kullan
      this.omerComments = existingComments.map((c: any) => c.id);
      this.log(`${this.omerComments.length} mevcut comment kullanılacak`, 'success');
      return;
    }

    // Yeterli comment yoksa yeni oluştur
    this.log(`Sadece ${existingComments.length} mevcut comment var, yeni comment'ler oluşturuluyor...`, 'info');
    
    // Mevcut comment'leri de ekle
    this.omerComments = existingComments.map((c: any) => c.id);

    // İlk post'a eksik kadar comment ekle
    const postId = this.omerPosts[0];
    const neededComments = 2 - this.omerComments.length;
    const comments = [
      'Bu bir test yorumudur - Comment like testi için',
      'İkinci test yorumu - Comment reply testi için',
    ];

    for (let i = 0; i < neededComments && i < comments.length; i++) {
      try {
        const comment = await (this.prisma as any).contentComment.create({
          data: {
            id: generateIdForModel('ContentComment'),
            postId,
            userId: this.omer.id,
            comment: comments[i],
            isAnswer: false,
            createdAt: new Date(),
          },
        });
        this.omerComments.push(comment.id);
        this.log(`Yeni comment oluşturuldu: ${comment.id}`, 'success');
      } catch (error: any) {
        this.log(`Comment oluşturulurken hata: ${error.message}`, 'warn');
      }
    }

    if (this.omerComments.length === 0) {
      this.log('⚠️ Hiç comment bulunamadı ve oluşturulamadı!', 'warn');
    } else {
      this.log(`Toplam ${this.omerComments.length} comment hazır`, 'success');
    }
  }

  /**
   * Bildirim doğrulama
   */
  private async verifyNotification(
    userId: string,
    type: NotificationType,
    timeout: number = 5000
  ): Promise<string | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const notification = await (this.prisma as any).notification.findFirst({
        where: {
          userId,
          type,
          read: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (notification) {
        return notification.id;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  /**
   * Senaryo 1: POST_LIKED
   */
  private async scenarioPostLiked(): Promise<void> {
    this.log('\n📌 Senaryo 1: POST_LIKED', 'info');
    
    if (!this.omer || this.omerPosts.length === 0) {
      this.results.push({
        scenario: 'POST_LIKED',
        notificationType: NotificationType.POST_LIKED,
        success: false,
        error: 'Ömer veya post bulunamadı',
      });
      return;
    }

    const alice = this.testUsers.get('alice');
    if (!alice) {
      this.results.push({
        scenario: 'POST_LIKED',
        notificationType: NotificationType.POST_LIKED,
        success: false,
        error: 'Alice kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const postId = this.omerPosts[0];
      await this.api.post(
        `/interactions/posts/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${alice.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.POST_LIKED
      );

      if (notificationId) {
        this.log(`✅ POST_LIKED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'POST_LIKED',
          notificationType: NotificationType.POST_LIKED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ POST_LIKED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'POST_LIKED',
          notificationType: NotificationType.POST_LIKED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ POST_LIKED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'POST_LIKED',
        notificationType: NotificationType.POST_LIKED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 2: POST_COMMENTED
   */
  private async scenarioPostCommented(): Promise<void> {
    this.log('\n📌 Senaryo 2: POST_COMMENTED', 'info');
    
    if (!this.omer || this.omerPosts.length === 0) {
      this.results.push({
        scenario: 'POST_COMMENTED',
        notificationType: NotificationType.POST_COMMENTED,
        success: false,
        error: 'Ömer veya post bulunamadı',
      });
      return;
    }

    const alice = this.testUsers.get('alice');
    if (!alice) {
      this.results.push({
        scenario: 'POST_COMMENTED',
        notificationType: NotificationType.POST_COMMENTED,
        success: false,
        error: 'Alice kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const postId = this.omerPosts[1] || this.omerPosts[0];
      await this.api.post(
        `/interactions/posts/${postId}/comments`,
        { comment: 'Harika bir paylaşım! Test yorumu.' },
        { headers: { Authorization: `Bearer ${alice.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.POST_COMMENTED
      );

      if (notificationId) {
        this.log(`✅ POST_COMMENTED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'POST_COMMENTED',
          notificationType: NotificationType.POST_COMMENTED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ POST_COMMENTED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'POST_COMMENTED',
          notificationType: NotificationType.POST_COMMENTED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ POST_COMMENTED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'POST_COMMENTED',
        notificationType: NotificationType.POST_COMMENTED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 3: POST_SHARED
   */
  private async scenarioPostShared(): Promise<void> {
    this.log('\n📌 Senaryo 3: POST_SHARED', 'info');
    
    if (!this.omer || this.omerPosts.length === 0) {
      this.results.push({
        scenario: 'POST_SHARED',
        notificationType: NotificationType.POST_SHARED,
        success: false,
        error: 'Ömer veya post bulunamadı',
      });
      return;
    }

    const bob = this.testUsers.get('bob');
    if (!bob) {
      this.results.push({
        scenario: 'POST_SHARED',
        notificationType: NotificationType.POST_SHARED,
        success: false,
        error: 'Bob kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const postId = this.omerPosts[2] || this.omerPosts[0];
      
      // Önce mevcut share'ı sil (eğer varsa)
      const existingShare = await (this.prisma as any).contentShare.findFirst({
        where: {
          userId: bob.id,
          postId: postId,
        },
      });
      
      if (existingShare) {
        await (this.prisma as any).contentShare.delete({
          where: { id: existingShare.id },
        });
        this.log('Mevcut share silindi, yeni share oluşturuluyor...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await this.api.post(
        `/interactions/posts/${postId}/share`,
        { shareType: 'INTERNAL_REPOST' },
        { headers: { Authorization: `Bearer ${bob.token}` } }
      );

      // Bildirimin işlenmesi için biraz bekle
      await new Promise(resolve => setTimeout(resolve, 2000));

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.POST_SHARED,
        10000 // 10 saniye bekle
      );

      if (notificationId) {
        this.log(`✅ POST_SHARED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'POST_SHARED',
          notificationType: NotificationType.POST_SHARED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ POST_SHARED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'POST_SHARED',
          notificationType: NotificationType.POST_SHARED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ POST_SHARED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'POST_SHARED',
        notificationType: NotificationType.POST_SHARED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 4: POST_FAVORITED
   */
  private async scenarioPostFavorited(): Promise<void> {
    this.log('\n📌 Senaryo 4: POST_FAVORITED', 'info');
    
    if (!this.omer || this.omerPosts.length === 0) {
      this.results.push({
        scenario: 'POST_FAVORITED',
        notificationType: NotificationType.POST_FAVORITED,
        success: false,
        error: 'Ömer veya post bulunamadı',
      });
      return;
    }

    const charlie = this.testUsers.get('charlie');
    if (!charlie) {
      this.results.push({
        scenario: 'POST_FAVORITED',
        notificationType: NotificationType.POST_FAVORITED,
        success: false,
        error: 'Charlie kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const postId = this.omerPosts[3] || this.omerPosts[0];
      await this.api.post(
        `/interactions/posts/${postId}/bookmark`,
        {},
        { headers: { Authorization: `Bearer ${charlie.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.POST_FAVORITED
      );

      if (notificationId) {
        this.log(`✅ POST_FAVORITED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'POST_FAVORITED',
          notificationType: NotificationType.POST_FAVORITED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ POST_FAVORITED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'POST_FAVORITED',
          notificationType: NotificationType.POST_FAVORITED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ POST_FAVORITED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'POST_FAVORITED',
        notificationType: NotificationType.POST_FAVORITED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 5: COMMENT_LIKED
   */
  private async scenarioCommentLiked(): Promise<void> {
    this.log('\n📌 Senaryo 5: COMMENT_LIKED', 'info');
    
    if (!this.omer || this.omerComments.length === 0) {
      this.results.push({
        scenario: 'COMMENT_LIKED',
        notificationType: NotificationType.COMMENT_LIKED,
        success: false,
        error: 'Ömer veya comment bulunamadı',
      });
      return;
    }

    const diana = this.testUsers.get('diana');
    if (!diana) {
      this.results.push({
        scenario: 'COMMENT_LIKED',
        notificationType: NotificationType.COMMENT_LIKED,
        success: false,
        error: 'Diana kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const commentId = this.omerComments[0];
      await this.api.post(
        `/interactions/comments/${commentId}/like`,
        {},
        { headers: { Authorization: `Bearer ${diana.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.COMMENT_LIKED
      );

      if (notificationId) {
        this.log(`✅ COMMENT_LIKED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'COMMENT_LIKED',
          notificationType: NotificationType.COMMENT_LIKED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ COMMENT_LIKED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'COMMENT_LIKED',
          notificationType: NotificationType.COMMENT_LIKED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ COMMENT_LIKED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'COMMENT_LIKED',
        notificationType: NotificationType.COMMENT_LIKED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 6: COMMENT_REPLIED
   */
  private async scenarioCommentReplied(): Promise<void> {
    this.log('\n📌 Senaryo 6: COMMENT_REPLIED', 'info');
    
    if (!this.omer || this.omerComments.length === 0 || this.omerPosts.length === 0) {
      this.results.push({
        scenario: 'COMMENT_REPLIED',
        notificationType: NotificationType.COMMENT_REPLIED,
        success: false,
        error: 'Ömer, comment veya post bulunamadı',
      });
      return;
    }

    const eve = this.testUsers.get('eve');
    if (!eve) {
      this.results.push({
        scenario: 'COMMENT_REPLIED',
        notificationType: NotificationType.COMMENT_REPLIED,
        success: false,
        error: 'Eve kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      const postId = this.omerPosts[0];
      const parentCommentId = this.omerComments[0];
      
      await this.api.post(
        `/interactions/posts/${postId}/comments`,
        {
          comment: 'Teşekkürler! Bu bir yanıt yorumudur.',
          parentId: parentCommentId,
        },
        { headers: { Authorization: `Bearer ${eve.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.COMMENT_REPLIED
      );

      if (notificationId) {
        this.log(`✅ COMMENT_REPLIED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'COMMENT_REPLIED',
          notificationType: NotificationType.COMMENT_REPLIED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ COMMENT_REPLIED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'COMMENT_REPLIED',
          notificationType: NotificationType.COMMENT_REPLIED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ COMMENT_REPLIED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'COMMENT_REPLIED',
        notificationType: NotificationType.COMMENT_REPLIED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 7: NEW_TRUSTER
   */
  private async scenarioNewTruster(): Promise<void> {
    this.log('\n📌 Senaryo 7: NEW_TRUSTER', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'NEW_TRUSTER',
        notificationType: NotificationType.NEW_TRUSTER,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    const bob = this.testUsers.get('bob');
    if (!bob) {
      this.results.push({
        scenario: 'NEW_TRUSTER',
        notificationType: NotificationType.NEW_TRUSTER,
        success: false,
        error: 'Bob kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      // Önce mevcut trust relation'ı sil (eğer varsa)
      const existingTrust = await this.prisma.trustRelation.findFirst({
        where: {
          trusterId: bob.id,
          trustedUserId: this.omer.id,
        },
      });
      
      if (existingTrust) {
        await this.prisma.trustRelation.delete({
          where: { id: existingTrust.id },
        });
        this.log('Mevcut trust relation silindi, yeni trust oluşturuluyor...', 'info');
        // Biraz bekle
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await this.api.post(
        '/users/trust',
        { targetUserId: this.omer.id },
        { headers: { Authorization: `Bearer ${bob.token}` } }
      );

      // Bildirimin işlenmesi için biraz bekle (queue processing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.NEW_TRUSTER,
        10000 // 10 saniye bekle
      );

      if (notificationId) {
        this.log(`✅ NEW_TRUSTER bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'NEW_TRUSTER',
          notificationType: NotificationType.NEW_TRUSTER,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ NEW_TRUSTER bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'NEW_TRUSTER',
          notificationType: NotificationType.NEW_TRUSTER,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      // Trust zaten varsa hata verebilir, bu normal
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
        this.log('⚠️ Trust ilişkisi zaten mevcut, bildirim kontrol ediliyor...', 'warn');
        const notificationId = await this.verifyNotification(
          this.omer.id,
          NotificationType.NEW_TRUSTER
        );
        if (notificationId) {
          this.results.push({
            scenario: 'NEW_TRUSTER',
            notificationType: NotificationType.NEW_TRUSTER,
            success: true,
            notificationId,
          });
          return;
        }
      }
      this.log(`❌ NEW_TRUSTER hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'NEW_TRUSTER',
        notificationType: NotificationType.NEW_TRUSTER,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 8: NEW_TRUSTED_BY
   */
  private async scenarioNewTrustedBy(): Promise<void> {
    this.log('\n📌 Senaryo 8: NEW_TRUSTED_BY', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'NEW_TRUSTED_BY',
        notificationType: NotificationType.NEW_TRUSTED_BY,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    const charlie = this.testUsers.get('charlie');
    if (!charlie) {
      this.results.push({
        scenario: 'NEW_TRUSTED_BY',
        notificationType: NotificationType.NEW_TRUSTED_BY,
        success: false,
        error: 'Charlie kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      // Önce mevcut trust relation'ı sil (eğer varsa)
      const existingTrust = await this.prisma.trustRelation.findFirst({
        where: {
          trusterId: charlie.id,
          trustedUserId: this.omer.id,
        },
      });
      
      if (existingTrust) {
        await this.prisma.trustRelation.delete({
          where: { id: existingTrust.id },
        });
        this.log('Mevcut trust relation silindi, yeni trust oluşturuluyor...', 'info');
        // Biraz bekle
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await this.api.post(
        '/users/trust',
        { targetUserId: this.omer.id },
        { headers: { Authorization: `Bearer ${charlie.token}` } }
      );

      // Bildirimin işlenmesi için biraz bekle (queue processing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.NEW_TRUSTED_BY,
        10000 // 10 saniye bekle
      );

      if (notificationId) {
        this.log(`✅ NEW_TRUSTED_BY bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'NEW_TRUSTED_BY',
          notificationType: NotificationType.NEW_TRUSTED_BY,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ NEW_TRUSTED_BY bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'NEW_TRUSTED_BY',
          notificationType: NotificationType.NEW_TRUSTED_BY,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
        this.log('⚠️ Trust ilişkisi zaten mevcut', 'warn');
        const notificationId = await this.verifyNotification(
          this.omer.id,
          NotificationType.NEW_TRUSTED_BY
        );
        if (notificationId) {
          this.results.push({
            scenario: 'NEW_TRUSTED_BY',
            notificationType: NotificationType.NEW_TRUSTED_BY,
            success: true,
            notificationId,
          });
          return;
        }
      }
      this.log(`❌ NEW_TRUSTED_BY hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'NEW_TRUSTED_BY',
        notificationType: NotificationType.NEW_TRUSTED_BY,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 9: NEW_MESSAGE
   */
  private async scenarioNewMessage(): Promise<void> {
    this.log('\n📌 Senaryo 9: NEW_MESSAGE', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'NEW_MESSAGE',
        notificationType: NotificationType.NEW_MESSAGE,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    const diana = this.testUsers.get('diana');
    if (!diana) {
      this.results.push({
        scenario: 'NEW_MESSAGE',
        notificationType: NotificationType.NEW_MESSAGE,
        success: false,
        error: 'Diana kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      await this.api.post(
        '/messages',
        {
          recipientUserId: this.omer.id,
          message: 'Merhaba Ömer! Bu bir test mesajıdır.',
        },
        { headers: { Authorization: `Bearer ${diana.token}` } }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.NEW_MESSAGE
      );

      if (notificationId) {
        this.log(`✅ NEW_MESSAGE bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'NEW_MESSAGE',
          notificationType: NotificationType.NEW_MESSAGE,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ NEW_MESSAGE bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'NEW_MESSAGE',
          notificationType: NotificationType.NEW_MESSAGE,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ NEW_MESSAGE hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'NEW_MESSAGE',
        notificationType: NotificationType.NEW_MESSAGE,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 10: EXPERT_REQUEST_AVAILABLE
   */
  private async scenarioExpertRequestAvailable(): Promise<void> {
    this.log('\n📌 Senaryo 10: EXPERT_REQUEST_AVAILABLE', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'EXPERT_REQUEST_AVAILABLE',
        notificationType: NotificationType.EXPERT_REQUEST_AVAILABLE,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    const diana = this.testUsers.get('diana');
    if (!diana) {
      this.results.push({
        scenario: 'EXPERT_REQUEST_AVAILABLE',
        notificationType: NotificationType.EXPERT_REQUEST_AVAILABLE,
        success: false,
        error: 'Diana kullanıcısı bulunamadı',
      });
      return;
    }

    try {
      // Ömer expert request oluşturur
      // Not: Endpoint multipart/form-data bekliyor ama JSON ile de çalışabilir
      // Eğer hata alırsak, FormData kullanmamız gerekebilir
      const response = await this.api.post(
        '/expert/request',
        {
          description: 'Test expert request - Bildirim testi için oluşturuldu',
          tipsAmount: '0',
        },
        {
          headers: {
            Authorization: `Bearer ${this.omer.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const requestId = response.data.id;
      this.log(`Expert request oluşturuldu: ${requestId}`, 'success');

      // Diana'ya bildirim gitmeli (expert matching ile)
      // Biraz bekle (async processing için)
      await new Promise(resolve => setTimeout(resolve, 3000));

      const notificationId = await this.verifyNotification(
        diana.id,
        NotificationType.EXPERT_REQUEST_AVAILABLE,
        10000 // 10 saniye bekle (matching işlemi zaman alabilir)
      );

      if (notificationId) {
        this.log(`✅ EXPERT_REQUEST_AVAILABLE bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'EXPERT_REQUEST_AVAILABLE',
          notificationType: NotificationType.EXPERT_REQUEST_AVAILABLE,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ EXPERT_REQUEST_AVAILABLE bildirimi bulunamadı (expert matching çalışmıyor olabilir)', 'warn');
        this.results.push({
          scenario: 'EXPERT_REQUEST_AVAILABLE',
          notificationType: NotificationType.EXPERT_REQUEST_AVAILABLE,
          success: false,
          error: 'Bildirim bulunamadı - Expert matching çalışmıyor olabilir',
        });
      }
    } catch (error: any) {
      this.log(`❌ EXPERT_REQUEST_AVAILABLE hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'EXPERT_REQUEST_AVAILABLE',
        notificationType: NotificationType.EXPERT_REQUEST_AVAILABLE,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 11: NEW_BADGE
   */
  private async scenarioNewBadge(): Promise<void> {
    this.log('\n📌 Senaryo 11: NEW_BADGE', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'NEW_BADGE',
        notificationType: NotificationType.NEW_BADGE,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    try {
      // Badge'leri al
      const badges = await this.prisma.badge.findMany({ take: 1 });
      if (badges.length === 0) {
        this.log('⚠️ Badge bulunamadı, bildirim manuel gönderilecek', 'warn');
        // NotificationService'i direkt kullan
        const { NotificationService } = await import('../src/application/notification/notification.service');
        const notificationService = new NotificationService();
        await notificationService.sendNotification(
          this.omer.id,
          NotificationType.NEW_BADGE,
          {
            badgeName: 'Test Badge',
            badgeIcon: '🏆',
            badgeId: 'test-badge-id',
          }
        );

        const notificationId = await this.verifyNotification(
          this.omer.id,
          NotificationType.NEW_BADGE
        );

        if (notificationId) {
          this.log(`✅ NEW_BADGE bildirimi gönderildi - ID: ${notificationId}`, 'success');
          this.results.push({
            scenario: 'NEW_BADGE',
            notificationType: NotificationType.NEW_BADGE,
            success: true,
            notificationId,
          });
        } else {
          this.results.push({
            scenario: 'NEW_BADGE',
            notificationType: NotificationType.NEW_BADGE,
            success: false,
            error: 'Bildirim bulunamadı',
          });
        }
        return;
      }

      // GamificationService üzerinden badge ver
      const { GamificationService } = await import('../src/application/gamification/gamification.service');
      const gamificationService = new GamificationService();
      await gamificationService.grantBadgeToUser(this.omer.id, badges[0].id);

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.NEW_BADGE
      );

      if (notificationId) {
        this.log(`✅ NEW_BADGE bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'NEW_BADGE',
          notificationType: NotificationType.NEW_BADGE,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ NEW_BADGE bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'NEW_BADGE',
          notificationType: NotificationType.NEW_BADGE,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ NEW_BADGE hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'NEW_BADGE',
        notificationType: NotificationType.NEW_BADGE,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 12: ACHIEVEMENT_UNLOCKED
   */
  private async scenarioAchievementUnlocked(): Promise<void> {
    this.log('\n📌 Senaryo 12: ACHIEVEMENT_UNLOCKED', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'ACHIEVEMENT_UNLOCKED',
        notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    try {
      // Achievement'leri al
      const achievements = await this.prisma.achievementGoal.findMany({ take: 1 });
      if (achievements.length === 0) {
        this.log('⚠️ Achievement bulunamadı, bildirim manuel gönderilecek', 'warn');
        const { NotificationService } = await import('../src/application/notification/notification.service');
        const notificationService = new NotificationService();
        await notificationService.sendNotification(
          this.omer.id,
          NotificationType.ACHIEVEMENT_UNLOCKED,
          {
            achievementName: 'Test Achievement',
            achievementIcon: '🏆',
            achievementId: 'test-achievement-id',
          }
        );

        const notificationId = await this.verifyNotification(
          this.omer.id,
          NotificationType.ACHIEVEMENT_UNLOCKED
        );

        if (notificationId) {
          this.log(`✅ ACHIEVEMENT_UNLOCKED bildirimi gönderildi - ID: ${notificationId}`, 'success');
          this.results.push({
            scenario: 'ACHIEVEMENT_UNLOCKED',
            notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
            success: true,
            notificationId,
          });
        } else {
          this.results.push({
            scenario: 'ACHIEVEMENT_UNLOCKED',
            notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
            success: false,
            error: 'Bildirim bulunamadı',
          });
        }
        return;
      }

      // GamificationService üzerinden achievement ver
      const { GamificationService } = await import('../src/application/gamification/gamification.service');
      const gamificationService = new GamificationService();
      await gamificationService.grantAchievementToUser(this.omer.id, achievements[0].id);

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.ACHIEVEMENT_UNLOCKED
      );

      if (notificationId) {
        this.log(`✅ ACHIEVEMENT_UNLOCKED bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'ACHIEVEMENT_UNLOCKED',
          notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ ACHIEVEMENT_UNLOCKED bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'ACHIEVEMENT_UNLOCKED',
          notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ ACHIEVEMENT_UNLOCKED hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'ACHIEVEMENT_UNLOCKED',
        notificationType: NotificationType.ACHIEVEMENT_UNLOCKED,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryo 13: SYSTEM_ANNOUNCEMENT
   */
  private async scenarioSystemAnnouncement(): Promise<void> {
    this.log('\n📌 Senaryo 13: SYSTEM_ANNOUNCEMENT', 'info');
    
    if (!this.omer) {
      this.results.push({
        scenario: 'SYSTEM_ANNOUNCEMENT',
        notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
        success: false,
        error: 'Ömer bulunamadı',
      });
      return;
    }

    try {
      // NotificationService'i direkt kullan
      const { NotificationService } = await import('../src/application/notification/notification.service');
      const notificationService = new NotificationService();
      await notificationService.sendNotification(
        this.omer.id,
        NotificationType.SYSTEM_ANNOUNCEMENT,
        {
          title: 'Sistem Duyurusu',
          message: 'Bu bir test sistem duyurusudur.',
        }
      );

      const notificationId = await this.verifyNotification(
        this.omer.id,
        NotificationType.SYSTEM_ANNOUNCEMENT
      );

      if (notificationId) {
        this.log(`✅ SYSTEM_ANNOUNCEMENT bildirimi gönderildi - ID: ${notificationId}`, 'success');
        this.results.push({
          scenario: 'SYSTEM_ANNOUNCEMENT',
          notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
          success: true,
          notificationId,
        });
      } else {
        this.log('⚠️ SYSTEM_ANNOUNCEMENT bildirimi bulunamadı', 'warn');
        this.results.push({
          scenario: 'SYSTEM_ANNOUNCEMENT',
          notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
          success: false,
          error: 'Bildirim bulunamadı',
        });
      }
    } catch (error: any) {
      this.log(`❌ SYSTEM_ANNOUNCEMENT hatası: ${error.message}`, 'error');
      this.results.push({
        scenario: 'SYSTEM_ANNOUNCEMENT',
        notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Senaryoları çalıştır
   */
  public async run(): Promise<void> {
    try {
      this.log('═══════════════════════════════════════════════════════', 'info');
      this.log('🚀 Kapsamlı Bildirim Sistemi Test Başlatılıyor', 'info');
      this.log('═══════════════════════════════════════════════════════', 'info');

      // 1. Ömer'i hazırla
      await this.setupOmer();

      // 2. Test kullanıcılarını hazırla
      await this.setupTestUsers();

      // 3. Ömer için test verileri oluştur
      await this.createOmerPosts();
      await this.createOmerComments();

      // 4. Senaryoları çalıştır
      this.log('\n📋 Senaryolar çalıştırılıyor...\n', 'info');

      await this.scenarioPostLiked();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioPostCommented();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioPostShared();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioPostFavorited();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioCommentLiked();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioCommentReplied();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioNewTruster();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioNewTrustedBy();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioNewMessage();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioExpertRequestAvailable();
      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.scenarioNewBadge();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioAchievementUnlocked();
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.scenarioSystemAnnouncement();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 5. Özet rapor
      this.printSummary();

    } catch (error: any) {
      this.log(`\n❌ Test sırasında hata: ${error.message}`, 'error');
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Özet rapor yazdır
   */
  private printSummary(): void {
    this.log('\n═══════════════════════════════════════════════════════', 'info');
    this.log('📊 TEST ÖZET RAPORU', 'info');
    this.log('═══════════════════════════════════════════════════════', 'info');

    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    this.log(`\nToplam Senaryo: ${total}`, 'info');
    this.log(`✅ Başarılı: ${successful}`, 'success');
    this.log(`❌ Başarısız: ${failed}`, failed > 0 ? 'error' : 'info');

    this.log('\n📋 Detaylı Sonuçlar:', 'info');
    for (const result of this.results) {
      if (result.success) {
        this.log(`  ✅ ${result.scenario} - Bildirim ID: ${result.notificationId}`, 'success');
      } else {
        this.log(`  ❌ ${result.scenario} - Hata: ${result.error}`, 'error');
      }
    }

    // Ömer'in bildirimlerini listele
    if (this.omer) {
      this.log('\n📬 Ömer\'in Bildirimleri:', 'info');
      (this.prisma as any).notification
        .findMany({
          where: { userId: this.omer.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
        .then((notifications: any[]) => {
          this.log(`  Toplam ${notifications.length} bildirim bulundu`, 'info');
          notifications.forEach(n => {
            this.log(`  - ${n.type}: ${n.title} (${n.read ? 'Okundu' : 'Okunmadı'})`, 'info');
          });
        })
        .catch((err: any) => {
          this.log(`  Bildirimler alınırken hata: ${err.message}`, 'error');
        });
    }

    this.log('\n═══════════════════════════════════════════════════════', 'info');
  }
}

// Script'i çalıştır
const tester = new ComprehensiveNotificationTester();
tester.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

