export class ContentPostTag {
  constructor(
    public readonly id: string,
    public readonly postId: string,
    public readonly tag: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  getTag(): string {
    return this.tag;
  }

  getCleanTag(): string {
    return this.tag.toLowerCase().trim();
  }

  matchesTag(searchTag: string): boolean {
    return this.getCleanTag() === searchTag.toLowerCase().trim();
  }
}