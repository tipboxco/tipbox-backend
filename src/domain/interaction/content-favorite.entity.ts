export class ContentFavorite {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  isRecentFavorite(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Within last week
  }
}