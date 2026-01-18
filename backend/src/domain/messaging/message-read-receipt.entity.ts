export class MessageReadReceipt {
  constructor(
    public readonly id: string,
    public readonly messageId: string,
    public readonly userId: string,
    public readonly readAt: Date
  ) {}

  // Business logic methods
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  belongsToMessage(messageId: string): boolean {
    return this.messageId === messageId;
  }

  getReadTimeAgo(): string {
    const minutes = Math.floor((Date.now() - this.readAt.getTime()) / (1000 * 60));
    
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dakika önce`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    
    return this.readAt.toLocaleDateString('tr-TR');
  }
}
