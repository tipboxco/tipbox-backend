export class ContentComment {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly userId: number,
    public readonly parentId: number | null,
    public readonly comment: string,
    public readonly isAnswer: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  belongsToUser(userId: number): boolean {
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
}