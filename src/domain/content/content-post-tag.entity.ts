export class ContentPostTag {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly tag: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
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