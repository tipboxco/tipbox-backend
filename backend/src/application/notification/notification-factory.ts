import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';

/** Safely extract a string value from notification data */
function str(val: unknown): string {
  return typeof val === 'string' ? val : String(val ?? '');
}

export interface NotificationTemplate {
  type: NotificationType;
  category: NotificationCategory;
  getTitle: (data: Record<string, unknown>) => string;
  getMessage: (data: Record<string, unknown>) => string;
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
      getTitle: () => 'Post Liked! ❤️',
      getMessage: (data) => `${data.likerName} liked your post`,
    });

    this.registerTemplate({
      type: NotificationType.POST_COMMENTED,
      category: NotificationCategory.POST,
      getTitle: () => 'New Comment! 💬',
      getMessage: (data) => `${data.commenterName} commented on your post`,
    });

    this.registerTemplate({
      type: NotificationType.POST_SHARED,
      category: NotificationCategory.POST,
      getTitle: () => 'Post Shared! 🔄',
      getMessage: (data) => `${data.sharerName} shared your post`,
    });

    this.registerTemplate({
      type: NotificationType.POST_FAVORITED,
      category: NotificationCategory.POST,
      getTitle: () => 'Added to Favorites! ⭐',
      getMessage: (data) => `${data.userName} added your post to favorites`,
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_LIKED,
      category: NotificationCategory.POST,
      getTitle: () => 'Comment Liked! 💙',
      getMessage: (data) => `${data.likerName} liked your comment`,
    });

    this.registerTemplate({
      type: NotificationType.COMMENT_REPLIED,
      category: NotificationCategory.POST,
      getTitle: () => 'New Reply! 💬',
      getMessage: (data) => `${data.replierName} replied to your comment`,
    });

    // Trust & Follow
    this.registerTemplate({
      type: NotificationType.NEW_TRUSTER,
      category: NotificationCategory.TRUST,
      getTitle: () => 'New Follower! 👥',
      getMessage: (data) => `${data.trusterName} started following you`,
    });

    this.registerTemplate({
      type: NotificationType.NEW_TRUSTED_BY,
      category: NotificationCategory.TRUST,
      getTitle: () => 'Following You! 🤝',
      getMessage: (data) => `${data.trustedName} is now following you`,
    });

    // Messaging
    // NEW_MESSAGE kaldırıldı - zaten inbox ekranında görüntülenecek
    // Sadece önemli durumlar için bildirim gönderilecek (DM_REQUEST_ACCEPTED, SUPPORT_REQUEST_ACCEPTED)

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_RECEIVED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'New Support Request! 🆘',
      getMessage: (data) => {
        const msg = str(data.message);
        return `${data.userName || data.requesterName} sent you a support request${msg ? `: "${msg.substring(0, 50)}${msg.length > 50 ? '...' : ''}"` : ''}`;
      },
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_ACCEPTED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Request Accepted! ✅',
      getMessage: (data) => `${data.userName || data.accepterName} accepted your request`,
    });

    this.registerTemplate({
      type: NotificationType.DM_REQUEST_DECLINED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Request Declined ❌',
      getMessage: (data) => `${data.userName} declined your request`,
    });

    this.registerTemplate({
      type: NotificationType.SUPPORT_REQUEST_ACCEPTED,
      category: NotificationCategory.SUPPORT,
      getTitle: () => 'Support Request Accepted! ✅',
      getMessage: (data) => `${data.userName || data.accepterName} accepted your support request`,
    });

    // Gamification
    this.registerTemplate({
      type: NotificationType.NEW_BADGE,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'New Badge Earned! 🏆',
      getMessage: (data) => `You earned the ${data.badgeName} badge!`,
    });

    this.registerTemplate({
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Achievement Unlocked! 🎯',
      getMessage: (data) => `You completed the ${data.achievementName} achievement!`,
    });

    this.registerTemplate({
      type: NotificationType.REWARD_EARNED,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Reward Earned! 🎁',
      getMessage: (data) => `You earned ${data.amount} TIPS!`,
    });

    this.registerTemplate({
      type: NotificationType.BADGE_REMINDER,
      category: NotificationCategory.GAMIFICATION,
      getTitle: () => 'Badge Reminder ⏰',
      getMessage: (data) => `Complete your "${data.badgeName || 'badge'}" goal to earn this badge!`,
    });

    // Expert
    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_AVAILABLE,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'New Expert Question! 💡',
      getMessage: (data) => `New question with ${data.tipsAmount} TIPS reward`,
    });

    this.registerTemplate({
      type: NotificationType.EXPERT_REQUEST_ANSWERED,
      category: NotificationCategory.EXPERT,
      getTitle: () => 'Question Answered! 💡',
      getMessage: (data) => `${data.expertName} answered your question`,
    });

    // System
    this.registerTemplate({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      category: NotificationCategory.SYSTEM,
      getTitle: (data) => str(data.title) || 'System Announcement',
      getMessage: (data) => str(data.message),
    });

    this.registerTemplate({
      type: NotificationType.TIPS_RECEIVED,
      category: NotificationCategory.SYSTEM,
      getTitle: () => 'TIPS Received! 💰',
      getMessage: (data) => `You received ${data.amount || 0} TIPS`,
    });

    // Event Notifications
    this.registerTemplate({
      type: NotificationType.EVENT_STARTED,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Event Started! 🎉',
      getMessage: (data) => `${data.eventName} event has started!`,
    });

    this.registerTemplate({
      type: NotificationType.EVENT_ENDING_SOON,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Event Ending Soon! ⏰',
      getMessage: (data) => `${data.eventName} event ends in ${data.hoursRemaining} hours`,
    });

    this.registerTemplate({
      type: NotificationType.EVENT_REWARD_AVAILABLE,
      category: NotificationCategory.EVENT,
      getTitle: () => 'Event Reward Available! 🎁',
      getMessage: (data) => `You can claim ${data.rewardAmount} TIPS reward from ${data.eventName} event!`,
    });

    // Collection Notifications
    this.registerTemplate({
      type: NotificationType.COLLECTION_POST_ADDED,
      category: NotificationCategory.COLLECTION,
      getTitle: () => 'Post Added to Collection! 📚',
      getMessage: (data) => `Your post was added to "${data.collectionName}" collection`,
    });

    this.registerTemplate({
      type: NotificationType.COLLECTION_SHARED,
      category: NotificationCategory.COLLECTION,
      getTitle: () => 'Collection Shared! 📤',
      getMessage: (data) => `${data.sharerName || data.userName} shared "${data.collectionName}" collection`,
    });

    // Wallet Notifications
    this.registerTemplate({
      type: NotificationType.WALLET_CONNECTED,
      category: NotificationCategory.WALLET,
      getTitle: () => 'Wallet Connected! 👛',
      getMessage: (data) => `Wallet successfully connected: ${data.walletAddress}`,
    });

    this.registerTemplate({
      type: NotificationType.WALLET_DISCONNECTED,
      category: NotificationCategory.WALLET,
      getTitle: () => 'Wallet Disconnected! 🔌',
      getMessage: (data) => `Your wallet has been disconnected: ${data.walletAddress}`,
    });

    // Transaction Notifications
    this.registerTemplate({
      type: NotificationType.TRANSACTION_CONFIRMED,
      category: NotificationCategory.TRANSACTION,
      getTitle: () => 'Transaction Confirmed! ✅',
      getMessage: (data) => {
        const actionMap: Record<string, string> = {
          TIP_SEND: `Your ${data.amount} TIPS transfer completed`,
          TIP_RECEIVE: `Your ${data.amount} TIPS receipt completed`,
          CLAIM_REWARD: `Your ${data.amount} TIPS reward claim confirmed`,
          NFT_BUY: `Your NFT purchase completed`,
          NFT_SELL: `Your NFT sale completed`,
          SWAP_TIP_TO_SOL: `Your ${data.amount} TIPS → SOL swap completed`,
          SWAP_SOL_TO_TIP: `Your ${data.amount} SOL → TIPS swap completed`,
          DEPOSIT: `Your ${data.amount} TIPS deposit completed`,
          WITHDRAW: `Your ${data.amount} TIPS withdrawal completed`,
        };
        return actionMap[str(data.actionType)] || `Your ${data.amount} TIPS transaction completed`;
      },
    });

    this.registerTemplate({
      type: NotificationType.TRANSACTION_FAILED,
      category: NotificationCategory.TRANSACTION,
      getTitle: () => 'Transaction Failed! ❌',
      getMessage: (data) => {
        const reason = data.errorMessage || 'An unknown error occurred';
        return `Your transaction failed: ${reason}`;
      },
    });

    this.registerTemplate({
      type: NotificationType.TRANSACTION_PENDING,
      category: NotificationCategory.TRANSACTION,
      getTitle: () => 'Transaction Pending! ⏳',
      getMessage: (data) => `Your ${data.amount} TIPS transaction is processing`,
    });

    this.registerTemplate({
      type: NotificationType.TIPS_SENT,
      category: NotificationCategory.TRANSACTION,
      getTitle: () => 'TIPS Sent! 💸',
      getMessage: (data) => `You sent ${data.amount} TIPS to ${data.recipientName}`,
    });

    // Reward Notifications
    this.registerTemplate({
      type: NotificationType.REWARD_CLAIMABLE,
      category: NotificationCategory.REWARD,
      getTitle: () => 'New Reward Earned! 🎁',
      getMessage: (data) => {
        const sourceMap: Record<string, string> = {
          LADDER_REWARD: 'Ladder ranking',
          TIPS_RECEIVED: 'TIPS earnings',
          SUPPORT_SESSION: 'Support session',
          BADGE_EARNED: 'Badge earned',
          ACHIEVEMENT_UNLOCKED: 'Achievement unlocked',
          EVENT_PARTICIPATION: 'Event participation',
          SYSTEM_GRANT: 'System grant',
        };
        const source = sourceMap[str(data.sourceType)] || 'Reward';
        return `You can claim ${data.amount} TIPS for ${source}`;
      },
    });

    this.registerTemplate({
      type: NotificationType.REWARD_CLAIMED,
      category: NotificationCategory.REWARD,
      getTitle: () => 'Reward Claimed! 💰',
      getMessage: (data) => `Your ${data.amount} TIPS reward has been added to your wallet`,
    });

    this.registerTemplate({
      type: NotificationType.REWARD_EXPIRED,
      category: NotificationCategory.REWARD,
      getTitle: () => 'Reward Expired! ⏰',
      getMessage: (data) => `Your ${data.amount} TIPS reward expired because it was not claimed`,
    });

    this.registerTemplate({
      type: NotificationType.MULTIPLE_REWARDS_AVAILABLE,
      category: NotificationCategory.REWARD,
      getTitle: () => 'Multiple Rewards Available! 🎁✨',
      getMessage: (data) => `You can claim ${data.count} rewards worth ${data.totalAmount} TIPS`,
    });

    // NFT Notifications
    this.registerTemplate({
      type: NotificationType.NFT_RECEIVED,
      category: NotificationCategory.NFT,
      getTitle: () => 'NFT Received! 🎨',
      getMessage: (data) => `${data.senderName} sent you "${data.nftName}" NFT`,
    });

    this.registerTemplate({
      type: NotificationType.NFT_SENT,
      category: NotificationCategory.NFT,
      getTitle: () => 'NFT Sent! 📤',
      getMessage: (data) => `You sent "${data.nftName}" NFT to ${data.recipientName}`,
    });

    this.registerTemplate({
      type: NotificationType.NFT_PURCHASED,
      category: NotificationCategory.NFT,
      getTitle: () => 'NFT Purchased! 🛒',
      getMessage: (data) => `You purchased "${data.nftName}" NFT for ${data.price} TIPS`,
    });

    this.registerTemplate({
      type: NotificationType.NFT_SOLD,
      category: NotificationCategory.NFT,
      getTitle: () => 'NFT Sold! 💰',
      getMessage: (data) => `Your "${data.nftName}" NFT was sold for ${data.price} TIPS`,
    });

    this.registerTemplate({
      type: NotificationType.NFT_LISTED,
      category: NotificationCategory.NFT,
      getTitle: () => 'NFT Listed! 🏷️',
      getMessage: (data) => `Your "${data.nftName}" NFT is now listed on the marketplace for ${data.price} TIPS`,
    });

    this.registerTemplate({
      type: NotificationType.NFT_LISTING_SOLD,
      category: NotificationCategory.NFT,
      getTitle: () => 'Listed NFT Sold! 🎉',
      getMessage: (data) => `Your "${data.nftName}" NFT was purchased by ${data.buyerName}. You earned ${data.receivedAmount} TIPS`,
    });
  }

  private registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.type, template);
  }

  public createNotification(type: NotificationType, data: Record<string, unknown>) {
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

