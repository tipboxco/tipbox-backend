export class UserDevice {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly location: string | null,
    public readonly userAgent: string,
    public readonly ipAddress: string | null,
    public readonly isActive: boolean,
    public readonly firstLoginAt: Date,
    public readonly lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  isCurrentlyActive(): boolean {
    return this.isActive;
  }

  getDisplayDate(): Date {
    return this.lastLoginAt || this.firstLoginAt;
  }
}

