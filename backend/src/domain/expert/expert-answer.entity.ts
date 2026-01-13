export class ExpertAnswer {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly expertUserId: string,
    public readonly content: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  belongsToExpert(expertUserId: string): boolean {
    return this.expertUserId === expertUserId;
  }

  isForRequest(requestId: string): boolean {
    return this.requestId === requestId;
  }

  hasContent(): boolean {
    return this.content.trim().length > 0;
  }
}

