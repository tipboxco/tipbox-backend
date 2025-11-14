export class ContentLike {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string | null,
    public readonly commentId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  isPostLike(): boolean {
    return this.postId !== null && this.commentId === null;
  }

  isCommentLike(): boolean {
    return this.commentId !== null && this.postId === null;
  }

  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  belongsToComment(commentId: string): boolean {
    return this.commentId === commentId;
  }

  isRecentLike(): boolean {
    const minutesSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60)
    );
    return minutesSinceCreated <= 30; // Within last 30 minutes
  }
}