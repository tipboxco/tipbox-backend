import { LootboxStatus } from './lootbox-status.enum';

export class Lootbox {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly tipsLocked: number,
    public readonly status: LootboxStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  isLocked(): boolean {
    return this.status === LootboxStatus.LOCKED;
  }

  isOpenable(): boolean {
    return this.status === LootboxStatus.OPENABLE;
  }

  isClaimed(): boolean {
    return this.status === LootboxStatus.CLAIMED;
  }

  getTipsLocked(): number {
    return this.tipsLocked;
  }

  isHighValue(): boolean {
    return this.tipsLocked >= 1000;
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case LootboxStatus.LOCKED: return 'Kilitli';
      case LootboxStatus.OPENABLE: return 'Açılabilir';
      case LootboxStatus.CLAIMED: return 'Talep Edildi';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case LootboxStatus.LOCKED: return '#ef4444';      // Red
      case LootboxStatus.OPENABLE: return '#22c55e';    // Green
      case LootboxStatus.CLAIMED: return '#6b7280';     // Gray
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case LootboxStatus.LOCKED: return '🔒';
      case LootboxStatus.OPENABLE: return '📦';
      case LootboxStatus.CLAIMED: return '✅';
    }
  }

  canBeOpened(): boolean {
    return this.isOpenable();
  }

  canBeClaimed(): boolean {
    return this.isOpenable(); // Assuming openable means ready for claiming
  }

  getTipsLockedFormatted(): string {
    if (this.tipsLocked >= 1000000) return `${(this.tipsLocked / 1000000).toFixed(1)}M TIPS`;
    if (this.tipsLocked >= 1000) return `${(this.tipsLocked / 1000).toFixed(1)}K TIPS`;
    return `${this.tipsLocked} TIPS`;
  }

  getValue(): number {
    return this.tipsLocked;
  }

  getValueCategory(): 'LOW' | 'MEDIUM' | 'HIGH' | 'EPIC' {
    if (this.tipsLocked >= 10000) return 'EPIC';
    if (this.tipsLocked >= 1000) return 'HIGH';
    if (this.tipsLocked >= 100) return 'MEDIUM';
    return 'LOW';
  }

  getValueCategoryDisplayName(): string {
    switch (this.getValueCategory()) {
      case 'LOW': return 'Düşük Değer';
      case 'MEDIUM': return 'Orta Değer';
      case 'HIGH': return 'Yüksek Değer';
      case 'EPIC': return 'Epik Değer';
    }
  }

  getValueCategoryColor(): string {
    switch (this.getValueCategory()) {
      case 'LOW': return '#9ca3af';       // Gray
      case 'MEDIUM': return '#3b82f6';    // Blue
      case 'HIGH': return '#8b5cf6';      // Purple
      case 'EPIC': return '#f59e0b';      // Yellow/Gold
    }
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7;
  }

  getDaysToUnlock(): number {
    // This would depend on business logic - for now return 0 if openable
    return this.isOpenable() ? 0 : 1; // Simple implementation
  }
}