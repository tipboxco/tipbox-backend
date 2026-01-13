import { BadgeType } from './badge-type.enum';
import { BadgeRarity } from './badge-rarity.enum';

export class Badge {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly imageUrl: string | null,
    public readonly type: BadgeType,
    public readonly rarity: BadgeRarity,
    public readonly boostMultiplier: number | null,
    public readonly rewardMultiplier: number | null,
    public readonly categoryId: string,
    public readonly createdAt: Date
  ) {}

  // Essential business methods only
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} rozeti`;
  }

  hasImage(): boolean {
    return this.imageUrl !== null;
  }

  isAchievementBadge(): boolean {
    return this.type === BadgeType.ACHIEVEMENT;
  }

  isEventBadge(): boolean {
    return this.type === BadgeType.EVENT;
  }

  isCosmeticBadge(): boolean {
    return this.type === BadgeType.COSMETIC;
  }

  isCommon(): boolean {
    return this.rarity === BadgeRarity.COMMON;
  }

  isRare(): boolean {
    return this.rarity === BadgeRarity.RARE;
  }

  isEpic(): boolean {
    return this.rarity === BadgeRarity.EPIC;
  }

  hasBoostMultiplier(): boolean {
    return this.boostMultiplier !== null && this.boostMultiplier > 1;
  }

  hasRewardMultiplier(): boolean {
    return this.rewardMultiplier !== null && this.rewardMultiplier > 1;
  }

  getEffectiveBoostMultiplier(): number {
    return this.boostMultiplier ?? 1.0;
  }

  getEffectiveRewardMultiplier(): number {
    return this.rewardMultiplier ?? 1.0;
  }

  getRarityDisplayName(): string {
    switch (this.rarity) {
      case BadgeRarity.COMMON: return 'Yaygın';
      case BadgeRarity.RARE: return 'Nadir';
      case BadgeRarity.EPIC: return 'Efsanevi';
    }
  }

  getTypeDisplayName(): string {
    switch (this.type) {
      case BadgeType.ACHIEVEMENT: return 'Başarı';
      case BadgeType.EVENT: return 'Etkinlik';
      case BadgeType.COSMETIC: return 'Kozmetik';
    }
  }

  getRarityColor(): string {
    switch (this.rarity) {
      case BadgeRarity.COMMON: return '#6b7280';  // Gray
      case BadgeRarity.RARE: return '#3b82f6';    // Blue
      case BadgeRarity.EPIC: return '#8b5cf6';    // Purple
    }
  }

  getPointValue(): number {
    let basePoints = 10;
    
    // Rarity multiplier
    switch (this.rarity) {
      case BadgeRarity.RARE: basePoints *= 3; break;
      case BadgeRarity.EPIC: basePoints *= 5; break;
    }
    
    // Type multiplier
    if (this.isAchievementBadge()) basePoints *= 2;
    
    return basePoints;
  }
}