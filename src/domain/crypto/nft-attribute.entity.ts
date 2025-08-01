export class NFTAttribute {
  constructor(
    public readonly id: number,
    public readonly nftId: number,
    public readonly key: string,
    public readonly value: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToNFT(nftId: number): boolean {
    return this.nftId === nftId;
  }

  getKey(): string {
    return this.key;
  }

  getValue(): string {
    return this.value;
  }

  getDisplayName(): string {
    // Convert snake_case or camelCase to Title Case
    return this.key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  isNumericValue(): boolean {
    return !isNaN(Number(this.value));
  }

  isBooleanValue(): boolean {
    return this.value.toLowerCase() === 'true' || this.value.toLowerCase() === 'false';
  }

  isColorValue(): boolean {
    // Check if value looks like a color (hex, rgb, or color name)
    return this.value.startsWith('#') || 
           this.value.startsWith('rgb') || 
           this.key.toLowerCase().includes('color') ||
           this.key.toLowerCase().includes('colour');
  }

  getNumericValue(): number | null {
    return this.isNumericValue() ? Number(this.value) : null;
  }

  getBooleanValue(): boolean | null {
    if (!this.isBooleanValue()) return null;
    return this.value.toLowerCase() === 'true';
  }

  getAttributeType(): 'NUMBER' | 'BOOLEAN' | 'COLOR' | 'TEXT' {
    if (this.isNumericValue()) return 'NUMBER';
    if (this.isBooleanValue()) return 'BOOLEAN';
    if (this.isColorValue()) return 'COLOR';
    return 'TEXT';
  }

  getAttributeIcon(): string {
    const key = this.key.toLowerCase();
    if (key.includes('power') || key.includes('strength')) return '💪';
    if (key.includes('speed') || key.includes('velocity')) return '⚡';
    if (key.includes('defense') || key.includes('shield')) return '🛡️';
    if (key.includes('magic') || key.includes('mana')) return '🔮';
    if (key.includes('luck') || key.includes('fortune')) return '🍀';
    if (key.includes('color') || key.includes('colour')) return '🎨';
    if (key.includes('size') || key.includes('scale')) return '📏';
    if (key.includes('level') || key.includes('tier')) return '📊';
    if (key.includes('rarity')) return '💎';
    return '📝';
  }

  isRareAttribute(): boolean {
    // Could be determined by rarity systems or special attributes
    const rareKeys = ['legendary', 'mythic', 'unique', 'special', 'rare'];
    return rareKeys.some(rareKey => 
      this.key.toLowerCase().includes(rareKey) || 
      this.value.toLowerCase().includes(rareKey)
    );
  }

  formatValue(): string {
    if (this.isNumericValue()) {
      const num = this.getNumericValue()!;
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    }
    
    if (this.isBooleanValue()) {
      return this.getBooleanValue() ? 'Evet' : 'Hayır';
    }
    
    return this.value;
  }
}