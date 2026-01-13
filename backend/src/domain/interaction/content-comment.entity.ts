export class ContentComment {
  constructor(
    public readonly id: string,
    public readonly postId: string,
    public readonly userId: string,
    public readonly parentId: string | null,
    public readonly comment: string,
    public readonly isAnswer: boolean,
    public readonly likesCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  isReply(): boolean {
    return this.parentId !== null;
  }

  isTopLevelComment(): boolean {
    return this.parentId === null;
  }

  isMarkedAsAnswer(): boolean {
    return this.isAnswer;
  }

  getComment(): string {
    return this.comment;
  }

  getWordCount(): number {
    return this.comment.split(' ').length;
  }

  isDetailedComment(): boolean {
    return this.getWordCount() > 20;
  }

  isRecentComment(): boolean {
    const minutesSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60)
    );
    return minutesSinceCreated <= 60; // Within last hour
  }

  getLikesCount(): number {
    return this.likesCount;
  }
}