import { ShareType } from './share-type.enum';

export class ContentShare {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly shareType: ShareType,
    public readonly platform: string | null,
    public readonly createdAt: Date
  ) {}

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  isInternalRepost(): boolean {
    return this.shareType === ShareType.INTERNAL_REPOST;
  }

  isExternalShare(): boolean {
    return this.shareType === ShareType.EXTERNAL_SHARE;
  }

  getSharePlatform(): string {
    return this.platform || 'unknown';
  }
}

