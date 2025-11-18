export class PasswordResetToken {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly token: string,
    public readonly isUsed: boolean,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isValid(): boolean {
    return !this.isUsed && !this.isExpired();
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isUsedToken(): boolean {
    return this.isUsed;
  }

  canBeUsed(): boolean {
    return this.isValid();
  }

  getExpirationStatus(): 'VALID' | 'EXPIRED' | 'USED' {
    if (this.isUsed) return 'USED';
    if (this.isExpired()) return 'EXPIRED';
    return 'VALID';
  }

  getTimeUntilExpiration(): string {
    if (this.isExpired()) return 'Süresi dolmuş';
    
    const millisecondsLeft = this.expiresAt.getTime() - Date.now();
    const minutesLeft = Math.floor(millisecondsLeft / (1000 * 60));
    
    if (minutesLeft < 1) return 'Az kaldı';
    if (minutesLeft < 60) return `${minutesLeft} dakika kaldı`;
    
    const hoursLeft = Math.floor(minutesLeft / 60);
    if (hoursLeft < 24) return `${hoursLeft} saat kaldı`;
    
    const daysLeft = Math.floor(hoursLeft / 24);
    return `${daysLeft} gün kaldı`;
  }

  getTimeSinceCreation(): string {
    const minutes = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
    
    if (minutes < 1) return 'Az önce oluşturuldu';
    if (minutes < 60) return `${minutes} dakika önce oluşturuldu`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce oluşturuldu`;
    
    const days = Math.floor(hours / 24);
    return `${days} gün önce oluşturuldu`;
  }

  getExpirationDisplayColor(): string {
    if (this.isUsed) return '#6b7280';     // Gray
    if (this.isExpired()) return '#ef4444'; // Red
    
    const hoursUntilExpiration = Math.floor(
      (this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    
    if (hoursUntilExpiration <= 1) return '#f59e0b'; // Yellow
    return '#22c55e'; // Green
  }

  isRecentlyCreated(): boolean {
    const minutesSinceCreation = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60)
    );
    return minutesSinceCreation <= 5; // Created within last 5 minutes
  }

  getDefaultExpirationHours(): number {
    return 24; // Default 24 hours
  }

  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  isTokenSecure(): boolean {
    // Basic token security checks
    return this.token.length >= 32 && 
           /^[A-Za-z0-9]+$/.test(this.token);
  }

  shouldBeCleanedUp(): boolean {
    // Clean up used or expired tokens after 30 days
    const daysSinceCreation = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return (this.isUsed || this.isExpired()) && daysSinceCreation >= 30;
  }
}