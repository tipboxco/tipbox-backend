export class MarketplaceBanner {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly imageUrl: string,
    public readonly linkUrl: string | null,
    public readonly isActive: boolean,
    public readonly displayOrder: number,
    public readonly startDate: Date | null,
    public readonly endDate: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(data: {
    id: string;
    title: string;
    description?: string | null;
    imageUrl: string;
    linkUrl?: string | null;
    isActive?: boolean;
    displayOrder: number;
    startDate?: Date | null;
    endDate?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): MarketplaceBanner {
    return new MarketplaceBanner(
      data.id,
      data.title,
      data.description || null,
      data.imageUrl,
      data.linkUrl || null,
      data.isActive ?? true,
      data.displayOrder,
      data.startDate || null,
      data.endDate || null,
      data.createdAt,
      data.updatedAt
    );
  }

  isCurrentlyActive(): boolean {
    if (!this.isActive) return false;

    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;

    return true;
  }
}

