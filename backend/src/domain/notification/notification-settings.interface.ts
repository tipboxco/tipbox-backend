export interface NotificationSettings {
  // Channel Preferences
  notificationEmailEnabled: boolean;
  notificationPushEnabled: boolean;
  notificationInAppEnabled: boolean;

  // Type Preferences
  trustNotifications: boolean;
  supportNotifications: boolean;
  messageNotifications: boolean;
  collectionNotifications: boolean;
  postNotifications: boolean;
}

export interface NotificationPreferences {
  userId: string;
  settings: NotificationSettings;
}

