export class ProductExperience {
  constructor(
    public readonly id: number,
    public readonly inventoryId: number,
    public readonly title: string,
    public readonly experienceText: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getTitle(): string {
    return this.title;
  }

  getExperienceText(): string {
    return this.experienceText;
  }

  belongsToInventory(inventoryId: number): boolean {
    return this.inventoryId === inventoryId;
  }

  isDetailed(): boolean {
    return this.experienceText.length > 200;
  }

  isRecentExperience(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 30;
  }

  getExperienceType(): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    const text = this.experienceText.toLowerCase();
    const positiveWords = ['iyi', 'güzel', 'memnun', 'başarılı', 'kaliteli'];
    const negativeWords = ['kötü', 'berbat', 'memnun değil', 'sorunlu', 'kalitesiz'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'POSITIVE';
    if (negativeCount > positiveCount) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  getWordCount(): number {
    return this.experienceText.split(' ').length;
  }
}