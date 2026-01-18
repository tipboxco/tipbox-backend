export class MessageReaction {
  constructor(
    public readonly id: string,
    public readonly messageId: string,
    public readonly userId: string,
    public readonly emoji: string,
    public readonly createdAt: Date
  ) {}

  // Business logic methods
  isValidEmoji(): boolean {
    // Basic emoji validation - can be enhanced
    return this.emoji.length > 0 && this.emoji.length <= 10;
  }

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  belongsToMessage(messageId: string): boolean {
    return this.messageId === messageId;
  }
}
