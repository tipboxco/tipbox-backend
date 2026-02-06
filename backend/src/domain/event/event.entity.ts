import { EventStatus } from './event-status.enum';

export class Event {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly status: EventStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description ?? 'Etkinlik açıklaması bulunmamaktadır.';
  }

  isDraft(): boolean {
    return this.status === EventStatus.DRAFT;
  }

  isPublished(): boolean {
    return this.status === EventStatus.PUBLISHED;
  }

  isClosed(): boolean {
    return this.status === EventStatus.CLOSED;
  }

  isActive(): boolean {
    const now = new Date();
    return this.isPublished() && now >= this.startDate && now <= this.endDate;
  }

  hasStarted(): boolean {
    return new Date() >= this.startDate;
  }

  hasEnded(): boolean {
    return new Date() > this.endDate;
  }

  isUpcoming(): boolean {
    return new Date() < this.startDate;
  }

  getDaysUntilStart(): number {
    if (this.hasStarted()) return 0;
    return Math.ceil((this.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  getDaysUntilEnd(): number {
    if (this.hasEnded()) return 0;
    return Math.ceil((this.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  getDurationDays(): number {
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  getEventStatus(): 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CLOSED' {
    if (this.isDraft()) return 'DRAFT';
    if (this.isClosed()) return 'CLOSED';
    if (this.isUpcoming()) return 'UPCOMING';
    if (this.isActive()) return 'ACTIVE';
    return 'ENDED';
  }

  getStatusDisplayName(): string {
    switch (this.getEventStatus()) {
      case 'DRAFT': return 'Taslak';
      case 'UPCOMING': return 'Yakında';
      case 'ACTIVE': return 'Aktif';
      case 'ENDED': return 'Sona Erdi';
      case 'CLOSED': return 'Kapatıldı';
    }
  }

  getStatusColor(): string {
    switch (this.getEventStatus()) {
      case 'DRAFT': return '#6b7280';      // Gray
      case 'UPCOMING': return '#f59e0b';   // Yellow
      case 'ACTIVE': return '#22c55e';     // Green
      case 'ENDED': return '#ef4444';      // Red
      case 'CLOSED': return '#374151';     // Dark Gray
    }
  }

  getStatusIcon(): string {
    switch (this.getEventStatus()) {
      case 'DRAFT': return '📝';
      case 'UPCOMING': return '⏳';
      case 'ACTIVE': return '🎯';
      case 'ENDED': return '🏁';
      case 'CLOSED': return '🔒';
    }
  }

  canParticipate(): boolean {
    return this.isActive();
  }
}
