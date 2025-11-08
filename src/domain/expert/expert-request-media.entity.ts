export class ExpertRequestMedia {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly mediaUrl: string,
    public readonly mediaType: string,
    public readonly uploadedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  isImage(): boolean {
    return this.mediaType === 'IMAGE';
  }

  isVideo(): boolean {
    return this.mediaType === 'VIDEO';
  }

  belongsToRequest(requestId: string): boolean {
    return this.requestId === requestId;
  }
}

