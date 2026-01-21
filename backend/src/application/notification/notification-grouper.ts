import { NotificationType } from '../../domain/notification/notification-type.enum';

/**
 * Gruplanabilir bildirim tipleri
 * Aynı postId ve type'a sahip bildirimler 1 dakika içinde gruplanabilir
 */
const GROUPABLE_TYPES: NotificationType[] = [
  NotificationType.POST_LIKED,
  NotificationType.POST_COMMENTED,
  NotificationType.POST_FAVORITED,
  NotificationType.COMMENT_LIKED,
  NotificationType.COMMENT_REPLIED,
];

/**
 * Gruplama window süresi (milisaniye)
 * Aynı postId + type'a sahip bildirimler bu süre içinde gruplanır
 */
const GROUPING_WINDOW_MS = 60 * 1000; // 1 dakika

export interface GroupedNotification {
  id: string; // Gruplanmış bildirim ID'si (ilk bildirimin ID'si veya özel bir ID)
  type: NotificationType;
  isGrouped: true;
  count: number; // Kaç bildirim gruplandı
  primaryUser: {
    id: string;
    username: string | null;
    avatar: string | null;
  };
  otherUsers: Array<{
    id: string;
    username: string | null;
    avatar: string | null;
  }>;
  postId?: string;
  commentId?: string;
  postContent?: string | null;
  postType?: string | null;
  description?: string | null; // Comment için
  imageUrl?: string | null;
  createdAt: Date;
  read: boolean;
  // Diğer alanlar (title, message, data vb.)
  title?: string;
  message?: string;
  data?: any;
}

export interface UngroupedNotification {
  id: string;
  type: NotificationType;
  // isGrouped sadece gruplanabilir bildirimlerde (POST_LIKED, POST_COMMENTED, POST_FAVORITED, COMMENT_LIKED, COMMENT_REPLIED) olur
  userId?: string;
  username?: string | null;
  avatar?: string | null;
  postId?: string;
  commentId?: string;
  postContent?: string | null;
  postType?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  amount?: number | null; // TIPS_RECEIVED için root seviyede
  createdAt: Date;
  read: boolean;
  title?: string;
  message?: string;
  data?: any;
}

export type ProcessedNotification = GroupedNotification | UngroupedNotification;

/**
 * Bildirimleri gruplar
 * Aynı postId + type'a sahip bildirimler 1 dakika içinde gruplanır
 */
export function groupNotifications(
  notifications: any[]
): ProcessedNotification[] {
  if (notifications.length === 0) {
    return [];
  }

  // Gruplanabilir bildirimleri ayır
  const groupableNotifications: any[] = [];
  const ungroupableNotifications: any[] = [];

  notifications.forEach((notif) => {
    const notifType = notif.type as NotificationType;
    if (GROUPABLE_TYPES.includes(notifType) && notif.data?.postId) {
      groupableNotifications.push(notif);
    } else {
      ungroupableNotifications.push(notif);
    }
  });

  // Gruplanabilir bildirimleri grupla
  const grouped = groupNotificationsByPostAndType(groupableNotifications);

  // Gruplanmamış bildirimleri de ekle (isGrouped alanı eklenmez)
  const ungrouped: UngroupedNotification[] = ungroupableNotifications.map((notif) => {
    const notifType = notif.type as NotificationType;
    const baseNotification: UngroupedNotification = {
      id: notif.id,
      type: notifType,
      // isGrouped alanı eklenmez - sadece gruplanabilir bildirimlerde olur
      userId: notif.userId || notif.data?.likerId || notif.data?.commenterId || notif.data?.userId || undefined,
      username: notif.username || null,
      avatar: notif.avatar || null,
      postId: notif.data?.postId,
      commentId: notif.data?.commentId,
      postContent: notif.data?.postContent || null,
      postType: notif.data?.postType || null,
      description: notif.data?.description || null,
      imageUrl: notif.data?.imageUrl || null,
      createdAt: new Date(notif.createdAt),
      read: notif.read || false,
      title: notif.title,
      message: notif.message,
      data: notif.data,
    };

    // EVENT_STARTED için sadece eventName, eventId ve imageUrl (root seviyede imageUrl olabilir)
    if (notifType === NotificationType.EVENT_STARTED) {
      return {
        ...baseNotification,
        data: {
          eventId: notif.data?.eventId,
          eventName: notif.data?.eventName,
          imageUrl: notif.data?.imageUrl || null,
        },
        imageUrl: notif.data?.imageUrl || null, // Root seviyede de olabilir
        // Gereksiz alanları kaldır
        userId: undefined,
        username: undefined,
        avatar: null,
        postId: undefined,
        commentId: undefined,
        postContent: undefined,
        postType: undefined,
        description: undefined,
      };
    }

    // Mesajlaşma bildirimleri için (DM_REQUEST_RECEIVED, DM_REQUEST_ACCEPTED, DM_REQUEST_DECLINED, SUPPORT_REQUEST_ACCEPTED)
    // Post ile ilgili tüm alanları kaldır, sadece userId, avatar, username ve request bilgileri
    if (
      notifType === NotificationType.DM_REQUEST_RECEIVED ||
      notifType === NotificationType.DM_REQUEST_ACCEPTED ||
      notifType === NotificationType.DM_REQUEST_DECLINED ||
      notifType === NotificationType.SUPPORT_REQUEST_ACCEPTED
    ) {
      return {
        ...baseNotification,
        // Post ile ilgili alanları kaldır
        postId: undefined,
        commentId: undefined,
        postContent: undefined,
        postType: undefined,
        description: undefined,
        imageUrl: undefined,
        // userId, avatar, username ve data kalacak
      };
    }

    // TIPS_RECEIVED için özel işlem: sadece userId, username, avatar, type ve amount (root seviyede)
    if (notifType === NotificationType.TIPS_RECEIVED) {
      const amount = notif.amount || notif.data?.amount || null;
      return {
        id: notif.id,
        type: notifType,
        userId: notif.userId || notif.data?.senderId || notif.data?.senderUserId || notif.data?.userId || undefined,
        username: notif.username || null,
        avatar: notif.avatar || null,
        amount: amount,
        createdAt: new Date(notif.createdAt),
        read: notif.read || false,
        // Post ile ilgili tüm alanlar kaldırıldı
        // data objesi kaldırıldı
      };
    }

    return baseNotification;
  });

  // Gruplanmış ve gruplanmamış bildirimleri birleştir ve tarihe göre sırala
  const allNotifications: ProcessedNotification[] = [...grouped, ...ungrouped];
  allNotifications.sort((a, b) => {
    const timeA = a.createdAt.getTime();
    const timeB = b.createdAt.getTime();
    return timeB - timeA; // Yeni önce
  });

  return allNotifications;
}

/**
 * Bildirimleri postId ve type'a göre gruplar
 */
function groupNotificationsByPostAndType(notifications: any[]): GroupedNotification[] {
  if (notifications.length === 0) {
    return [];
  }

  // Grupları oluştur: key = `${postId}_${type}`
  const groups = new Map<string, any[]>();

  notifications.forEach((notif) => {
    const postId = notif.data?.postId;
    const type = notif.type;
    const commentId = notif.data?.commentId; // Comment bildirimleri için commentId de önemli

    if (!postId || !type) {
      return; // Geçersiz bildirim, atla
    }

    // Comment bildirimleri için commentId'yi de key'e ekle
    const key = commentId 
      ? `${postId}_${type}_${commentId}`
      : `${postId}_${type}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(notif);
  });

  // Her grup için gruplanmış bildirim oluştur
  const groupedNotifications: (GroupedNotification | UngroupedNotification)[] = [];

  groups.forEach((groupNotifs, key) => {
    // Tarihe göre sırala (yeni önce)
    groupNotifs.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    // Eğer tek bildirim varsa, gruplama yapma (isGrouped alanı eklenmez)
    if (groupNotifs.length === 1) {
      const notif = groupNotifs[0];
      groupedNotifications.push({
        id: notif.id,
        type: notif.type as NotificationType,
        // isGrouped alanı eklenmez - sadece gruplanabilir bildirimlerde olur
        userId: notif.userId || notif.data?.likerId || notif.data?.commenterId || notif.data?.userId || undefined,
        username: notif.username || null,
        avatar: notif.avatar || null,
        postId: notif.data?.postId,
        commentId: notif.data?.commentId,
        postContent: notif.data?.postContent || null,
        postType: notif.data?.postType || null,
        description: notif.data?.description || null,
        imageUrl: notif.data?.imageUrl || null,
        createdAt: new Date(notif.createdAt),
        read: notif.read || false,
        title: notif.title,
        message: notif.message,
        data: notif.data,
      } as UngroupedNotification);
      return;
    }

    // Gruplama yap: Window içindeki bildirimleri grupla
    const windowGroups: any[][] = [];
    let currentWindow: any[] = [groupNotifs[0]];

    for (let i = 1; i < groupNotifs.length; i++) {
      const currentNotif = groupNotifs[i];
      const currentTime = new Date(currentNotif.createdAt).getTime();
      const firstInWindowTime = new Date(currentWindow[0].createdAt).getTime();
      const timeDiff = firstInWindowTime - currentTime;

      if (timeDiff <= GROUPING_WINDOW_MS) {
        // Aynı window içinde, ekle
        currentWindow.push(currentNotif);
      } else {
        // Yeni window başlat
        windowGroups.push(currentWindow);
        currentWindow = [currentNotif];
      }
    }
    windowGroups.push(currentWindow);

    // Her window için gruplanmış bildirim oluştur
    windowGroups.forEach((windowNotifs) => {
      if (windowNotifs.length === 1) {
        // Tek bildirim, gruplama yapma - ayrı bildirim olarak ekle (isGrouped alanı eklenmez)
        const notif = windowNotifs[0];
        groupedNotifications.push({
          id: notif.id,
          type: notif.type as NotificationType,
          // isGrouped alanı eklenmez - sadece gruplanabilir bildirimlerde olur
          userId: notif.userId || notif.data?.likerId || notif.data?.commenterId || notif.data?.userId || undefined,
          username: notif.username || null,
          avatar: notif.avatar || null,
          postId: notif.data?.postId,
          commentId: notif.data?.commentId,
          postContent: notif.data?.postContent || null,
          postType: notif.data?.postType || null,
          description: notif.data?.description || null,
          imageUrl: notif.data?.imageUrl || null,
          createdAt: new Date(notif.createdAt),
          read: notif.read || false,
          title: notif.title,
          message: notif.message,
          data: notif.data,
        } as UngroupedNotification);
        return;
      }

      // Gruplama yap
      const primaryNotif = windowNotifs[0]; // En yeni bildirim
      const otherNotifs = windowNotifs.slice(1);

      // Kullanıcıları topla (unique)
      const usersMap = new Map<string, { id: string; username: string | null; avatar: string | null }>();
      
      // Primary user
      const primaryUserId = primaryNotif.userId || primaryNotif.data?.likerId || primaryNotif.data?.commenterId || primaryNotif.data?.userId || '';
      usersMap.set(primaryUserId, {
        id: primaryUserId,
        username: primaryNotif.username || null,
        avatar: primaryNotif.avatar || null,
      });

      // Other users
      otherNotifs.forEach((notif) => {
        const userId = notif.userId || notif.data?.likerId || notif.data?.commenterId || notif.data?.userId || '';
        if (userId && userId !== primaryUserId && !usersMap.has(userId)) {
          usersMap.set(userId, {
            id: userId,
            username: notif.username || null,
            avatar: notif.avatar || null,
          });
        }
      });

      const primaryUser = usersMap.get(primaryUserId)!;
      usersMap.delete(primaryUserId);
      const otherUsers = Array.from(usersMap.values());

      // Gruplanmış bildirim oluştur
      groupedNotifications.push({
        id: primaryNotif.id, // İlk bildirimin ID'si
        type: primaryNotif.type as NotificationType,
        isGrouped: true,
        count: windowNotifs.length,
        primaryUser,
        otherUsers,
        postId: primaryNotif.data?.postId,
        commentId: primaryNotif.data?.commentId,
        postContent: primaryNotif.data?.postContent || null,
        postType: primaryNotif.data?.postType || null,
        description: primaryNotif.data?.description || null,
        imageUrl: primaryNotif.data?.imageUrl || null,
        createdAt: new Date(primaryNotif.createdAt),
        read: windowNotifs.some((n) => n.read), // En az biri okunmuşsa okunmuş sayılır
        title: primaryNotif.title,
        message: primaryNotif.message,
        data: primaryNotif.data,
      });
    });
  });

  return groupedNotifications;
}
