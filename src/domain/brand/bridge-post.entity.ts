export class BridgePost {
  constructor(
    public readonly id: number,
    public readonly brandId: number,
    public readonly userId: number,
    public readonly content: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToBrand(brandId: number): boolean {
    return this.brandId === brandId;
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getContent(): string {
    return this.content;
  }

  getWordCount(): number {
    return this.content.split(' ').length;
  }

  isDetailedPost(): boolean {
    return this.getWordCount() > 50;
  }

  isRecentPost(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7;
  }

  generateExcerpt(maxWords: number = 20): string {
    const words = this.content.split(' ');
    if (words.length <= maxWords) return this.content;
    return words.slice(0, maxWords).join(' ') + '...';
  }
}