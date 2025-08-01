export class BrandSurvey {
  constructor(
    public readonly id: number,
    public readonly brandId: number,
    public readonly title: string,
    public readonly description: string | null,
    public readonly startsAt: Date,
    public readonly endsAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToBrand(brandId: number): boolean {
    return this.brandId === brandId;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description ?? 'Anket açıklaması bulunmamaktadır.';
  }

  isActive(): boolean {
    const now = new Date();
    return now >= this.startsAt && now <= this.endsAt;
  }

  hasStarted(): boolean {
    return new Date() >= this.startsAt;
  }

  hasEnded(): boolean {
    return new Date() > this.endsAt;
  }

  isUpcoming(): boolean {
    return new Date() < this.startsAt;
  }

  getDaysUntilStart(): number {
    if (this.hasStarted()) return 0;
    return Math.ceil((this.startsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  getDaysUntilEnd(): number {
    if (this.hasEnded()) return 0;
    return Math.ceil((this.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  getDurationDays(): number {
    return Math.ceil((this.endsAt.getTime() - this.startsAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getStatus(): 'UPCOMING' | 'ACTIVE' | 'ENDED' {
    if (this.isUpcoming()) return 'UPCOMING';
    if (this.isActive()) return 'ACTIVE';
    return 'ENDED';
  }

  getStatusDisplayName(): string {
    switch (this.getStatus()) {
      case 'UPCOMING': return 'Yakında';
      case 'ACTIVE': return 'Aktif';
      case 'ENDED': return 'Sona Erdi';
    }
  }

  getStatusColor(): string {
    switch (this.getStatus()) {
      case 'UPCOMING': return '#f59e0b';   // Yellow
      case 'ACTIVE': return '#22c55e';     // Green
      case 'ENDED': return '#6b7280';      // Gray
    }
  }
}