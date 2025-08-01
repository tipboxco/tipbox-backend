export class DMSupportSession {
  constructor(
    public readonly id: number,
    public readonly threadId: number,
    public readonly helperId: number,
    public readonly tipsAmount: number,
    public readonly supportedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToThread(threadId: number): boolean {
    return this.threadId === threadId;
  }

  belongsToHelper(helperId: number): boolean {
    return this.helperId === helperId;
  }

  getTipsAmount(): number {
    return this.tipsAmount;
  }

  isHighValueSupport(): boolean {
    return this.tipsAmount >= 100;
  }

  isRecentSupport(): boolean {
    const daysSinceSupport = Math.floor(
      (Date.now() - this.supportedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceSupport <= 7;
  }

  getDaysSinceSupport(): number {
    return Math.floor((Date.now() - this.supportedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getTipsAmountFormatted(): string {
    if (this.tipsAmount >= 1000000) return `${(this.tipsAmount / 1000000).toFixed(1)}M TIPS`;
    if (this.tipsAmount >= 1000) return `${(this.tipsAmount / 1000).toFixed(1)}K TIPS`;
    return `${this.tipsAmount} TIPS`;
  }

  getSupportValue(): number {
    return this.tipsAmount;
  }

  getSupportValueCategory(): 'SMALL' | 'MEDIUM' | 'LARGE' | 'PREMIUM' {
    if (this.tipsAmount >= 1000) return 'PREMIUM';
    if (this.tipsAmount >= 500) return 'LARGE';
    if (this.tipsAmount >= 100) return 'MEDIUM';
    return 'SMALL';
  }

  getSupportValueCategoryDisplayName(): string {
    switch (this.getSupportValueCategory()) {
      case 'SMALL': return 'Küçük Destek';
      case 'MEDIUM': return 'Orta Destek';
      case 'LARGE': return 'Büyük Destek';
      case 'PREMIUM': return 'Premium Destek';
    }
  }

  getSupportValueColor(): string {
    switch (this.getSupportValueCategory()) {
      case 'SMALL': return '#9ca3af';      // Gray
      case 'MEDIUM': return '#3b82f6';     // Blue
      case 'LARGE': return '#8b5cf6';      // Purple
      case 'PREMIUM': return '#f59e0b';    // Gold
    }
  }

  getSupportIcon(): string {
    switch (this.getSupportValueCategory()) {
      case 'SMALL': return '🤝';
      case 'MEDIUM': return '💙';
      case 'LARGE': return '💜';
      case 'PREMIUM': return '👑';
    }
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceSupport();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }

  isGenerousSupport(): boolean {
    return this.tipsAmount >= 500;
  }

  getSupportType(): 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE' {
    if (this.tipsAmount >= 2000) return 'ENTERPRISE';
    if (this.tipsAmount >= 1000) return 'PREMIUM';
    if (this.tipsAmount >= 100) return 'STANDARD';
    return 'BASIC';
  }

  getSupportTypeDisplayName(): string {
    switch (this.getSupportType()) {
      case 'BASIC': return 'Temel Destek';
      case 'STANDARD': return 'Standart Destek';
      case 'PREMIUM': return 'Premium Destek';
      case 'ENTERPRISE': return 'Kurumsal Destek';
    }
  }
}