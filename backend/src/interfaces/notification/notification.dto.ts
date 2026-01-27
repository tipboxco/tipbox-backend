export interface RegisterPushTokenDto {
  token: string;
  deviceType: 'ios' | 'android' | 'web';
}

export interface UpdateNotificationSettingsDto {
  trustNotifications?: boolean;
  supportNotifications?: boolean;
  messageNotifications?: boolean;
  collectionNotifications?: boolean;
  postNotifications?: boolean;
  nftNotifications?: boolean;
  rewardNotifications?: boolean;
  transactionNotifications?: boolean;
  walletNotifications?: boolean;
  gamificationNotifications?: boolean;
  expertNotifications?: boolean;
  eventNotifications?: boolean;
  systemNotifications?: boolean;
  notificationEmailEnabled?: boolean;
  notificationPushEnabled?: boolean;
  notificationInAppEnabled?: boolean;
  receiveNotifications?: boolean | null;
}

export interface GetNotificationsQuery {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string; // NotificationType enum value
  category?: string; // NotificationCategory enum value
}

