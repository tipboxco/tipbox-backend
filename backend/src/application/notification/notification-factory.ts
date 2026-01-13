import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';

export interface NotificationTemplate {
  type: NotificationType;
  category: NotificationCategory;
  getTitle: (data: any) => string;
  getMessage: (data: any) => string;
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
    });

    this.registerTemplate({
      type: NotificationType.POST_COMMENTED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yeni Yorum! 💬',
      getMessage: (data) => `${data.commenterName} postunuza yorum yaptı`,
    });

    this.registerTemplate({
      type: NotificationType.POST_SHARED,
      category: NotificationCategory.POST,
      getTitle: () => 'Postunuz Paylaşıldı! 🔄',
      getMessage: (data) => `${data.sharerName} postunuzu paylaştı`,
    });

    this.registerTemplate({
      type: NotificationType.POST_FAVORITED,
      category: NotificationCategory.POST,
      getTitle: () => 'Favorilere Eklendi! ⭐',
      getMessage: (data) => `${data.userName} postunuzu favorilere ekledi`,
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_LIKED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yorumunuz Beğenildi! 💙',
      getMessage: (data) => `${data.likerName} yorumunuzu beğendi`,
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_REPLIED,
      category: NotificationCategory.POST,
      getTitle: () => 'Yorumunuza Yanıt Verildi! 💬',
      getMessage: (data) => `${data.replierName} yorumunuza yanıt verdi`,
    });

    // Trust & Follow
    this.registerTemplate({
      type: NotificationType.NEW_TRUSTER,
      category: NotificationCategory.TRUST,
      getTitle: () => 'Yeni Takipçi! 👥',
      getMessage: (data) => `${data.trusterName} seni takip etmeye başladı`,
    });

    this.registerTemplate({
      type: NotificationType.NEW_TRUSTED_BY,
      category: NotificationCategory.TRUST,
      getTitle: () => 'Seni Takip Ediyor! 🤝',
      getMessage: (data) => `${data.trustedName} artık seni takip ediyor`,
    });

    // Messaging
    this.registerTemplate({
      type: NotificationType.NEW_MESSAGE,
      category: NotificationCategory.MESSAGE,
      getTitle: () => 'Yeni Mesaj! 💬',
      getMessage: (data) => `${data.senderName}: ${data.messagePreview}`,
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_RECEIVED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Yeni Destek Talebi! 🆘',
      getMessage: (data) => `${data.requesterName} seninle iletişime geçmek istiyor`,
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_ACCEPTED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Talep Kabul Edildi! ✅',
      getMessage: (data) => `${data.accepterName} desteğini kabul etti`,
    });

    this.registerTemplate({
      type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Destek Talebi Kabul Edildi! ✅',
      getMessage: (data) => `${data.accepterName} destek talebinizi kabul etti`,
    });

    // Gamification
    this.registerTemplate({
      type: NotificationType.NEW_BADGE,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Yeni Rozet Kazandınız! 🏆',
      getMessage: (data) => `${data.badgeName} rozetini kazandınız!`,
    });

    this.registerTemplate({
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Başarı Açıldı! 🎯',
      getMessage: (data) => `${data.achievementName} başarısını tamamladınız!`,
    });

    this.registerTemplate({
      type: NotificationType.REWARD_EARNED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Ödül Kazandınız! 🎁',
      getMessage: (data) => `${data.amount} TIPS kazandınız!`,
    });

    // Expert
    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_AVAILABLE,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'Yeni Expert Sorusu! 💡',
      getMessage: (data) => `${data.tipsAmount} TIPS ödüllü yeni soru`,
    });

    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_ANSWERED,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'Sorunuz Yanıtlandı! 💡',
      getMessage: (data) => `${data.expertName} sorunuzu yanıtladı`,
    });

    // System
    this.registerTemplate({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      category: NotificationCategory.SYSTEM,
      getTitle: (data) => data.title || 'Sistem Duyurusu',
      getMessage: (data) => data.message,
    });

    this.registerTemplate({
      type: NotificationType.TIPS_RECEIVED,
      category: NotificationCategory.SYSTEM,
      getTitle: () => 'TIPS Aldınız! 💰',
      getMessage: (data) => `${data.senderName} size ${data.amount} TIPS gönderdi`,
    });

    // Event Notifications
    this.registerTemplate({
      type: NotificationType.EVENT_STARTED,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Etkinlik Başladı! 🎉',
      getMessage: (data) => `${data.eventName} etkinliği başladı!`,
    });

    this.registerTemplate({
      type: NotificationType.EVENT_ENDING_SOON,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Etkinlik Yakında Bitiyor! ⏰',
      getMessage: (data) => `${data.eventName} etkinliği ${data.hoursRemaining} saat içinde bitiyor`,
    });

    this.registerTemplate({
      type: NotificationType.EVENT_REWARD_AVAILABLE,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Etkinlik Ödülü Hazır! 🎁',
      getMessage: (data) => `${data.eventName} etkinliğinden ${data.rewardAmount} TIPS ödülü kazanabilirsiniz!`,
    });

    // Collection Notifications
    this.registerTemplate({
      type: NotificationType.COLLECTION_POST_ADDED,
      category: NotificationCategory.COLLECTION,
      getTitle: () => 'Postunuz Koleksiyona Eklendi! 📚',
      getMessage: (data) => `Postunuz "${data.collectionName}" koleksiyonuna eklendi`,
    });

    this.registerTemplate({
      type: NotificationType.COLLECTION_SHARED,
      category: NotificationCategory.COLLECTION,
      getTitle: () => 'Koleksiyon Paylaşıldı! 📤',
      getMessage: (data) => `${data.sharerName || data.userName} "${data.collectionName}" koleksiyonunu paylaştı`,
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
        // Navigation objesi kaldırıldı - mobil taraf kendi navigation logic'ini yönetecek
        // Gerekli ID'ler (postId, userId, threadId, vb.) data objesi içinde mevcut
      },
    };
  }

  public getCategoryForType(type: NotificationType): NotificationCategory | undefined {
    const template = this.templates.get(type);
    return template?.category;
  }

  /**
   * Get all notification types for a given category
   */
  public getTypesByCategory(category: NotificationCategory): NotificationType[] {
    const types: NotificationType[] = [];
    this.templates.forEach((template, type) => {
      if (template.category === category) {
        types.push(type);
      }
    });
    return types;
  }
}

