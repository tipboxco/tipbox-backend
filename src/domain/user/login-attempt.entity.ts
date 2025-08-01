import { LoginAttemptStatus } from './login-attempt-status.enum';

export class LoginAttempt {
  constructor(
    public readonly id: number,
    public readonly userId: number | null,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly status: LoginAttemptStatus,
    public readonly attemptedAt: Date
  ) {}

  // Business logic methods
  isSuccessful(): boolean {
    return this.status === LoginAttemptStatus.SUCCESS;
  }

  isFailed(): boolean {
    return this.status === LoginAttemptStatus.FAILED;
  }

  isLocked(): boolean {
    return this.status === LoginAttemptStatus.LOCKED;
  }

  isSuspicious(): boolean {
    return this.isFailed() || this.isLocked();
  }

  isRecentAttempt(): boolean {
    const minutesSinceAttempt = Math.floor(
      (Date.now() - this.attemptedAt.getTime()) / (1000 * 60)
    );
    return minutesSinceAttempt <= 15; // Recent if within last 15 minutes
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case LoginAttemptStatus.SUCCESS: return 'Başarılı';
      case LoginAttemptStatus.FAILED: return 'Başarısız';
      case LoginAttemptStatus.LOCKED: return 'Kilitli';
      default: return 'Bilinmiyor';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case LoginAttemptStatus.SUCCESS: return '#22c55e'; // Green
      case LoginAttemptStatus.FAILED: return '#f59e0b';  // Yellow
      case LoginAttemptStatus.LOCKED: return '#ef4444';  // Red
      default: return '#6b7280'; // Gray
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case LoginAttemptStatus.SUCCESS: return '✅';
      case LoginAttemptStatus.FAILED: return '❌';
      case LoginAttemptStatus.LOCKED: return '🔒';
      default: return '❓';
    }
  }

  getBrowserInfo(): { browser: string; os: string } {
    const ua = this.userAgent.toLowerCase();
    
    let browser = 'Unknown';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return { browser, os };
  }

  isMobileDevice(): boolean {
    const ua = this.userAgent.toLowerCase();
    return ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad');
  }

  getDeviceType(): 'MOBILE' | 'TABLET' | 'DESKTOP' {
    const ua = this.userAgent.toLowerCase();
    if (ua.includes('ipad') || ua.includes('tablet')) return 'TABLET';
    if (this.isMobileDevice()) return 'MOBILE';
    return 'DESKTOP';
  }

  isAnonymousAttempt(): boolean {
    return this.userId === null;
  }

  getTimeSinceAttempt(): string {
    const minutes = Math.floor((Date.now() - this.attemptedAt.getTime()) / (1000 * 60));
    
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  }
}