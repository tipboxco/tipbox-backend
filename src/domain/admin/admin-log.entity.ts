export class AdminLog {
  constructor(
    public readonly id: number,
    public readonly adminId: number,
    public readonly action: string,
    public readonly description: string | null,
    public readonly entityType: string,
    public readonly entityId: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToAdmin(adminId: number): boolean {
    return this.adminId === adminId;
  }

  getAction(): string {
    return this.action;
  }

  getDescription(): string {
    return this.description ?? 'Açıklama bulunmamaktadır.';
  }

  getEntityType(): string {
    return this.entityType;
  }

  getEntityId(): number {
    return this.entityId;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }

  isRecentLog(): boolean {
    const daysSinceLog = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLog <= 1;
  }

  getDaysSinceLog(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getActionType(): 'CREATE' | 'UPDATE' | 'DELETE' | 'BAN' | 'UNBAN' | 'MODERATE' | 'OTHER' {
    const action = this.action.toLowerCase();
    if (action.includes('create') || action.includes('add')) return 'CREATE';
    if (action.includes('update') || action.includes('edit') || action.includes('modify')) return 'UPDATE';
    if (action.includes('delete') || action.includes('remove')) return 'DELETE';
    if (action.includes('ban') && !action.includes('unban')) return 'BAN';
    if (action.includes('unban')) return 'UNBAN';
    if (action.includes('moderate') || action.includes('flag') || action.includes('warn')) return 'MODERATE';
    return 'OTHER';
  }

  getActionTypeDisplayName(): string {
    switch (this.getActionType()) {
      case 'CREATE': return 'Oluşturma';
      case 'UPDATE': return 'Güncelleme';
      case 'DELETE': return 'Silme';
      case 'BAN': return 'Yasaklama';
      case 'UNBAN': return 'Yasak Kaldırma';
      case 'MODERATE': return 'Moderasyon';
      case 'OTHER': return 'Diğer';
    }
  }

  getActionIcon(): string {
    switch (this.getActionType()) {
      case 'CREATE': return '➕';
      case 'UPDATE': return '✏️';
      case 'DELETE': return '🗑️';
      case 'BAN': return '🚫';
      case 'UNBAN': return '✅';
      case 'MODERATE': return '⚖️';
      case 'OTHER': return '📝';
    }
  }

  getActionColor(): string {
    switch (this.getActionType()) {
      case 'CREATE': return '#22c55e';     // Green
      case 'UPDATE': return '#3b82f6';     // Blue
      case 'DELETE': return '#ef4444';     // Red
      case 'BAN': return '#dc2626';        // Dark Red
      case 'UNBAN': return '#22c55e';      // Green
      case 'MODERATE': return '#f59e0b';   // Orange
      case 'OTHER': return '#6b7280';      // Gray
    }
  }

  getSeverityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const actionType = this.getActionType();
    if (actionType === 'DELETE' || actionType === 'BAN') return 'CRITICAL';
    if (actionType === 'MODERATE' || actionType === 'UNBAN') return 'HIGH';
    if (actionType === 'UPDATE') return 'MEDIUM';
    return 'LOW';
  }

  getSeverityLevelDisplayName(): string {
    switch (this.getSeverityLevel()) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'CRITICAL': return 'Kritik';
    }
  }

  getEntityDisplayName(): string {
    switch (this.entityType.toLowerCase()) {
      case 'user': return 'Kullanıcı';
      case 'post': return 'Gönderi';
      case 'comment': return 'Yorum';
      case 'product': return 'Ürün';
      case 'brand': return 'Marka';
      default: return this.entityType;
    }
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceLog();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }

  generateLogSummary(): string {
    return `${this.getActionTypeDisplayName()}: ${this.getEntityDisplayName()} #${this.entityId}`;
  }
}