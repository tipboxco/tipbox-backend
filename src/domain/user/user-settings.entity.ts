import { UserVisibility } from './user-visibility.enum';
import { NotificationCode } from './notification-code.enum';

export class UserSettings {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly themeId: string | null,
    public readonly receiveNotifications: boolean | null,
    public readonly visibility: UserVisibility | null,
    public readonly notificationEmailEnabled: boolean,
    public readonly notificationPushEnabled: boolean,
    public readonly notificationInAppEnabled: boolean,
    public readonly supportSessionPrice: number | null,
    public readonly supportSessionPriceUpdatedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isNotificationsEnabled(): boolean {
    return this.receiveNotifications ?? true; // Default to true
  }

  getEffectiveVisibility(): UserVisibility {
    return this.visibility ?? UserVisibility.PUBLIC; // Default to public
  }

  isPublicProfile(): boolean {
    return this.getEffectiveVisibility() === UserVisibility.PUBLIC;
  }

  isPrivateProfile(): boolean {
    return this.getEffectiveVisibility() === UserVisibility.PRIVATE;
  }

  isFriendsOnlyProfile(): boolean {
    return this.getEffectiveVisibility() === UserVisibility.FRIENDS_ONLY;
  }

  hasCustomTheme(): boolean {
    return this.themeId !== null;
  }

  getNotificationValue(code: NotificationCode): boolean {
    switch (code) {
      case NotificationCode.EMAIL:
        return this.notificationEmailEnabled;
      case NotificationCode.PUSH:
        return this.notificationPushEnabled;
      case NotificationCode.IN_APP:
        return this.notificationInAppEnabled;
      default:
        return false;
    }
  }

  canUpdateSupportSessionPrice(): boolean {
    if (!this.supportSessionPriceUpdatedAt) return true;
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    return this.supportSessionPriceUpdatedAt < tenDaysAgo;
  }

  getSupportSessionPrice(): number | null {
    return this.supportSessionPrice;
  }
}