import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';

export interface NotificationTemplate {
  type: NotificationType;
  category: NotificationCategory;
  getTitle: (data: any) => string;
  getMessage: (data: any) => string;
  getNavigationData: (data: any) => any;
}

export class NotificationFactory {
  private templates: Map<NotificationType, NotificationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Post Interactions
    this.registerTemplate({
      type: NotificationType.POST_LIKED,
      category: NotificationCategory.POST,
      getTitle: () => 'Postunuz Beğenildi! ❤️',
      getMessage: (data) => `${data.likerName} postunuzu beğendi`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    this.registerTemplate({
      type: NotificationType.POST_COMMENTED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yeni Yorum! 💬',
      getMessage: (data) => `${data.commenterName} postunuza yorum yaptı`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    this.registerTemplate({
      type: NotificationType.POST_SHARED,
      category: NotificationCategory.POST,
      getTitle: () => 'Postunuz Paylaşıldı! 🔄',
      getMessage: (data) => `${data.sharerName} postunuzu paylaştı`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    this.registerTemplate({
      type: NotificationType.POST_FAVORITED,
      category: NotificationCategory.POST,
      getTitle: () => 'Favorilere Eklendi! ⭐',
      getMessage: (data) => `${data.userName} postunuzu favorilere ekledi`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_LIKED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yorumunuz Beğenildi! 💙',
      getMessage: (data) => `${data.likerName} yorumunuzu beğendi`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_REPLIED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yorumunuza Yanıt Verildi! 💬',
      getMessage: (data) => `${data.replierName} yorumunuza yanıt verdi`,
      getNavigationData: (data) => ({ screen: 'PostDetail', postId: data.postId }),
    });

    // Trust & Follow
    this.registerTemplate({
      type: NotificationType.NEW_TRUSTER,
      category: NotificationCategory.TRUST,
      getTitle: () => 'Yeni Takipçi! 👥',
      getMessage: (data) => `${data.trusterName} seni takip etmeye başladı`,
      getNavigationData: (data) => ({ screen: 'Profile', userId: data.trusterId }),
    });

    this.registerTemplate({
      type: NotificationType.NEW_TRUSTED_BY,
      category: NotificationCategory.TRUST,
      getTitle: () => 'Seni Takip Ediyor! 🤝',
      getMessage: (data) => `${data.trustedName} artık seni takip ediyor`,
      getNavigationData: (data) => ({ screen: 'Profile', userId: data.trustedUserId }),
    });

    // Messaging
    this.registerTemplate({
      type: NotificationType.NEW_MESSAGE,
      category: NotificationCategory.MESSAGE,
      getTitle: () => 'Yeni Mesaj! 💬',
      getMessage: (data) => `${data.senderName}: ${data.messagePreview}`,
      getNavigationData: (data) => ({ screen: 'Chat', threadId: data.threadId }),
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_RECEIVED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Yeni Destek Talebi! 🆘',
      getMessage: (data) => `${data.requesterName} seninle iletişime geçmek istiyor`,
      getNavigationData: (data) => ({ screen: 'SupportRequests', requestId: data.requestId }),
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_ACCEPTED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Talep Kabul Edildi! ✅',
      getMessage: (data) => `${data.accepterName} desteğini kabul etti`,
      getNavigationData: (data) => ({ screen: 'Chat', threadId: data.threadId }),
    });

    // Gamification
    this.registerTemplate({
      type: NotificationType.NEW_BADGE,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Yeni Rozet Kazandınız! 🏆',
      getMessage: (data) => `${data.badgeName} rozetini kazandınız!`,
      getNavigationData: (data) => ({ screen: 'Badges', badgeId: data.badgeId }),
    });

    this.registerTemplate({
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Başarı Açıldı! 🎯',
      getMessage: (data) => `${data.achievementName} başarısını tamamladınız!`,
      getNavigationData: (data) => ({ screen: 'Achievements', achievementId: data.achievementId }),
    });

    this.registerTemplate({
      type: NotificationType.REWARD_EARNED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Ödül Kazandınız! 🎁',
      getMessage: (data) => `${data.amount} TIPS kazandınız!`,
      getNavigationData: (data) => ({ screen: 'Wallet' }),
    });

    // Expert
    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_AVAILABLE,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'Yeni Expert Sorusu! 💡',
      getMessage: (data) => `${data.tipsAmount} TIPS ödüllü yeni soru`,
      getNavigationData: (data) => ({ screen: 'ExpertRequests', requestId: data.requestId }),
    });

    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_ANSWERED,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'Sorunuz Yanıtlandı! 💡',
      getMessage: (data) => `${data.expertName} sorunuzu yanıtladı`,
      getNavigationData: (data) => ({ screen: 'ExpertRequests', requestId: data.requestId }),
    });

    // System
    this.registerTemplate({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      category: NotificationCategory.SYSTEM,
      getTitle: (data) => data.title || 'Sistem Duyurusu',
      getMessage: (data) => data.message,
      getNavigationData: () => ({}),
    });

    this.registerTemplate({
      type: NotificationType.TIPS_RECEIVED,
      category: NotificationCategory.SYSTEM,
      getTitle: () => 'TIPS Aldınız! 💰',
      getMessage: (data) => `${data.senderName} size ${data.amount} TIPS gönderdi`,
      getNavigationData: () => ({ screen: 'Wallet' }),
    });
  }

  private registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.type, template);
  }

  public createNotification(type: NotificationType, data: any) {
    const template = this.templates.get(type);

    if (!template) {
      throw new Error(`No template found for notification type: ${type}`);
    }

    return {
      type,
      category: template.category,
      title: template.getTitle(data),
      message: template.getMessage(data),
      data: {
        ...data,
        navigation: template.getNavigationData(data),
      },
    };
  }

  public getCategoryForType(type: NotificationType): NotificationCategory | undefined {
    const template = this.templates.get(type);
    return template?.category;
  }
}

