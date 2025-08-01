import { NFTType } from './nft-type.enum';
import { NFTRarity } from './nft-rarity.enum';

export class NFT {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly imageUrl: string,
    public readonly type: NFTType,
    public readonly rarity: NFTRarity,
    public readonly isTransferable: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} hakkında açıklama bulunmamaktadır.`;
  }

  getImageUrl(): string {
    return this.imageUrl;
  }

  isBadge(): boolean {
    return this.type === NFTType.BADGE;
  }

  isCosmetic(): boolean {
    return this.type === NFTType.COSMETIC;
  }

  isLootbox(): boolean {
    return this.type === NFTType.LOOTBOX;
  }

  isCommon(): boolean {
    return this.rarity === NFTRarity.COMMON;
  }

  isRare(): boolean {
    return this.rarity === NFTRarity.RARE;
  }

  isEpic(): boolean {
    return this.rarity === NFTRarity.EPIC;
  }

  canBeTransferred(): boolean {
    return this.isTransferable;
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 30;
  }

  getTypeDisplayName(): string {
    switch (this.type) {
      case NFTType.BADGE: return 'Rozet';
      case NFTType.COSMETIC: return 'Kozmetik';
      case NFTType.LOOTBOX: return 'Sandık';
    }
  }

  getRarityDisplayName(): string {
    switch (this.rarity) {
      case NFTRarity.COMMON: return 'Yaygın';
      case NFTRarity.RARE: return 'Nadir';
      case NFTRarity.EPIC: return 'Epik';
    }
  }

  getRarityColor(): string {
    switch (this.rarity) {
      case NFTRarity.COMMON: return '#9ca3af';   // Gray
      case NFTRarity.RARE: return '#3b82f6';     // Blue
      case NFTRarity.EPIC: return '#8b5cf6';     // Purple
    }
  }

  getRarityIcon(): string {
    switch (this.rarity) {
      case NFTRarity.COMMON: return '⚪';
      case NFTRarity.RARE: return '🔵';
      case NFTRarity.EPIC: return '🟣';
    }
  }

  getTypeIcon(): string {
    switch (this.type) {
      case NFTType.BADGE: return '🏅';
      case NFTType.COSMETIC: return '🎨';
      case NFTType.LOOTBOX: return '📦';
    }
  }

  getMarketValue(): number {
    // Basic value calculation based on rarity
    let baseValue = 10;
    
    switch (this.rarity) {
      case NFTRarity.COMMON: baseValue = 10; break;
      case NFTRarity.RARE: baseValue = 50; break;
      case NFTRarity.EPIC: baseValue = 200; break;
    }

    // Type multiplier
    switch (this.type) {
      case NFTType.BADGE: baseValue *= 1.5; break;
      case NFTType.COSMETIC: baseValue *= 1.2; break;
      case NFTType.LOOTBOX: baseValue *= 2; break;
    }

    return Math.floor(baseValue);
  }
}