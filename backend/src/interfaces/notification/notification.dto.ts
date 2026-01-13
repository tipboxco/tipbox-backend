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
  notificationEmailEnabled?: boolean;
  notificationPushEnabled?: boolean;
  notificationInAppEnabled?: boolean;
}

export interface GetNotificationsQuery {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string; // NotificationType enum value
  category?: string; // NotificationCategory enum value
}

