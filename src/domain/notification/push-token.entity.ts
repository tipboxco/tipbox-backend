export class PushToken {
  id: string;
  userId: string;
  token: string;
  deviceType: string;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    userId: string;
    token: string;
    deviceType: string;
    isActive: boolean;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.token = data.token;
    this.deviceType = data.deviceType;
    this.isActive = data.isActive;
    this.lastUsedAt = data.lastUsedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  deactivate(): void {
    this.isActive = false;
  }

  updateLastUsed(): void {
    this.lastUsedAt = new Date();
  }

  isExpired(): boolean {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.lastUsedAt < thirtyDaysAgo;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      token: this.token,
      deviceType: this.deviceType,
      isActive: this.isActive,
      lastUsedAt: this.lastUsedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

