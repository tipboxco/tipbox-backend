import { UserVisibility } from './user-visibility.enum';

export class UserSettings {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly themeId: number | null,
    public readonly receiveNotifications: boolean | null,
    public readonly visibility: UserVisibility | null,
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
}