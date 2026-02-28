import { NotificationType } from './notification-type.enum';

export class Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    read: boolean;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.type = data.type;
    this.title = data.title;
    this.message = data.message;
    this.data = data.data;
    this.read = data.read;
    this.readAt = data.readAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  markAsRead(): void {
    if (!this.read) {
      this.read = true;
      this.readAt = new Date();
    }
  }

  isRecent(): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
  }

  toJSON() {
    // Navigation objesini data'dan kaldır, diğer tüm ID'leri ve payload verilerini koru
    // Mobil taraf navigation yerine data içindeki ID'leri kullanacak:
    // 
    // Post Etkileşimleri (POST_LIKED, POST_COMMENTED, POST_SHARED, POST_FAVORITED, COMMENT_LIKED, COMMENT_REPLIED):
    //   - postId: Post detayına yönlendirme için (ZORUNLU)
    //   - commentId: Yorum detayı için (COMMENT_LIKED, COMMENT_REPLIED için)
    //   - likerId, commenterId, sharerId, replierId: İşlemi yapan kullanıcı ID'si
    // 
    // Trust & Follow (NEW_TRUSTER, NEW_TRUSTED_BY):
    //   - trusterId, trustedId: Takip eden/edilen kullanıcı ID'si
    // 
    // Messaging (NEW_MESSAGE, DM_REQUEST_RECEIVED, DM_REQUEST_ACCEPTED):
    //   - threadId: Chat ekranına yönlendirme için (ZORUNLU)
    //   - senderId, requesterId, accepterId: Mesaj gönderen/kabul eden kullanıcı ID'si
    //   - requestId: Support request ID'si (DM_REQUEST_RECEIVED için)
    // 
    // Gamification (NEW_BADGE, ACHIEVEMENT_UNLOCKED, REWARD_EARNED):
    //   - badgeId: Badge detayı için (NEW_BADGE için)
    //   - achievementId: Achievement detayı için (ACHIEVEMENT_UNLOCKED için)
    //   - amount: TIPS miktarı (REWARD_EARNED için)
    // 
    // Expert (EXPERT_REQUEST_AVAILABLE, EXPERT_REQUEST_ANSWERED):
    //   - requestId: Expert request ID'si (ZORUNLU)
    //   - expertId: Expert kullanıcı ID'si
    //   - tipsAmount: TIPS miktarı
    let dataWithoutNavigation: Record<string, unknown> | undefined = this.data;
    if (this.data && typeof this.data === 'object') {
      const { navigation, ...rest } = this.data as Record<string, unknown>;
      // Navigation dışındaki tüm alanları koru (ID'ler ve diğer payload verileri)
      dataWithoutNavigation = Object.keys(rest).length > 0 ? rest : undefined;
    }
    
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      title: this.title,
      message: this.message,
      data: dataWithoutNavigation, // Navigation olmadan, tüm ID'ler (postId, threadId, userId, vb.) ve payload verileri ile
      read: this.read,
      readAt: this.readAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

