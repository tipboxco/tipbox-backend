export class DMMessage {
  constructor(
    public readonly id: string,
    public readonly threadId: number,
    public readonly senderId: number,
    public readonly message: string,
    public readonly sentAt: Date,
    public readonly isRead: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToThread(threadId: number): boolean {
    return this.threadId === threadId;
  }

  belongsToSender(senderId: number): boolean {
    return this.senderId === senderId;
  }

  getMessage(): string {
    return this.message;
  }

  isReadMessage(): boolean {
    return this.isRead;
  }

  isUnreadMessage(): boolean {
    return !this.isRead;
  }

  getWordCount(): number {
    return this.message.split(' ').length;
  }

  isLongMessage(): boolean {
    return this.getWordCount() > 50;
  }

  generateExcerpt(maxWords: number = 10): string {
    const words = this.message.split(' ');
    if (words.length <= maxWords) return this.message;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  isRecentMessage(): boolean {
    const daysSinceSent = Math.floor(
      (Date.now() - this.sentAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceSent <= 1;
  }

  getMinutesSinceSent(): number {
    return Math.floor((Date.now() - this.sentAt.getTime()) / (1000 * 60));
  }

  getTimeAgo(): string {
    const minutes = this.getMinutesSinceSent();
    
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dakika önce`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    
    return this.sentAt.toLocaleDateString('tr-TR');
  }

  getMessageType(): 'SHORT' | 'MEDIUM' | 'LONG' | 'ESSAY' {
    const wordCount = this.getWordCount();
    if (wordCount > 100) return 'ESSAY';
    if (wordCount > 50) return 'LONG';
    if (wordCount > 10) return 'MEDIUM';
    return 'SHORT';
  }

  getMessageTypeDisplayName(): string {
    switch (this.getMessageType()) {
      case 'SHORT': return 'Kısa Mesaj';
      case 'MEDIUM': return 'Orta Mesaj';
      case 'LONG': return 'Uzun Mesaj';
      case 'ESSAY': return 'Detaylı Mesaj';
    }
  }

  containsQuestion(): boolean {
    return this.message.includes('?') || 
           this.message.toLowerCase().includes('nasıl') ||
           this.message.toLowerCase().includes('ne zaman') ||
           this.message.toLowerCase().includes('neden');
  }

  getReadStatus(): 'READ' | 'UNREAD' {
    return this.isRead ? 'READ' : 'UNREAD';
  }

  getReadStatusIcon(): string {
    return this.isRead ? '✓✓' : '✓';
  }
}