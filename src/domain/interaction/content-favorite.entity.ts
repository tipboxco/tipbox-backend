export class ContentFavorite {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly postId: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  isRecentFavorite(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Within last week
  }
}