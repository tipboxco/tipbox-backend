export class ContentLike {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly postId: number | null,
    public readonly commentId: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  isPostLike(): boolean {
    return this.postId !== null && this.commentId === null;
  }

  isCommentLike(): boolean {
    return this.commentId !== null && this.postId === null;
  }

  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  belongsToComment(commentId: number): boolean {
    return this.commentId === commentId;
  }

  isRecentLike(): boolean {
    const minutesSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60)
    );
    return minutesSinceCreated <= 30; // Within last 30 minutes
  }
}