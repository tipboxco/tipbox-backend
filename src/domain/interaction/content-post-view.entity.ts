export class ContentPostView {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly userId: number | null,
    public readonly viewedAt: Date,
    public readonly viewerIp: string,
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

  isAnonymousView(): boolean {
    return this.userId === null;
  }

  isAuthenticatedView(): boolean {
    return this.userId !== null;
  }

  getViewerIp(): string {
    return this.viewerIp;
  }

  isRecentView(): boolean {
    const minutesSinceView = Math.floor(
      (Date.now() - this.viewedAt.getTime()) / (1000 * 60)
    );
    return minutesSinceView <= 60; // Within last hour
  }

  isSameSession(otherView: ContentPostView): boolean {
    return this.viewerIp === otherView.viewerIp && 
           this.userId === otherView.userId;
  }
}