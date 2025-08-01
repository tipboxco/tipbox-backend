import { BadgeVisibility } from './badge-visibility.enum';

export class UserBadge {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly badgeId: number,
    public readonly isVisible: boolean,
    public readonly displayOrder: number | null,
    public readonly visibility: BadgeVisibility,
    public readonly claimed: boolean,
    public readonly claimedAt: Date | null
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToBadge(badgeId: number): boolean {
    return this.badgeId === badgeId;
  }

  isVisibleBadge(): boolean {
    return this.isVisible;
  }

  isClaimed(): boolean {
    return this.claimed && this.claimedAt !== null;
  }

  isPending(): boolean {
    return !this.claimed;
  }

  isPubliclyVisible(): boolean {
    return this.visibility === BadgeVisibility.PUBLIC && this.isVisible;
  }

  isPrivate(): boolean {
    return this.visibility === BadgeVisibility.PRIVATE;
  }

  isVisibleToFriends(): boolean {
    return this.visibility === BadgeVisibility.FRIENDS;
  }

  isVisibleToTrusters(): boolean {
    return this.visibility === BadgeVisibility.TRUSTERS;
  }

  getDisplayOrder(): number {
    return this.displayOrder ?? 999; // Default to end if no order set
  }

  canBeDisplayedTo(viewerRelation: 'PUBLIC' | 'FRIEND' | 'TRUSTER' | 'OWNER'): boolean {
    if (!this.isVisible) return false;
    if (viewerRelation === 'OWNER') return true;
    
    switch (this.visibility) {
      case BadgeVisibility.PUBLIC: return true;
      case BadgeVisibility.FRIENDS: return viewerRelation === 'FRIEND';
      case BadgeVisibility.TRUSTERS: return viewerRelation === 'TRUSTER' || viewerRelation === 'FRIEND';
      case BadgeVisibility.PRIVATE: return false;
    }
  }

  getDaysSinceClaimed(): number | null {
    if (!this.claimedAt) return null;
    return Math.floor((Date.now() - this.claimedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentlyClaimed(): boolean {
    const days = this.getDaysSinceClaimed();
    return days !== null && days <= 7;
  }
}