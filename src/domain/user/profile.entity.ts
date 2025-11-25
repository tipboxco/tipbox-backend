export class Profile {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly displayName: string | null,
    public readonly userName: string | null,
    public readonly bio: string | null,
    public readonly bannerUrl: string | null,
    public readonly cosmeticBadgeId: string | null,
    public readonly country: string | null,
    public readonly birthDate: Date | null,
    public readonly postsCount: number,
    public readonly trustCount: number,
    public readonly trusterCount: number,
    public readonly unseenFeedCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getFullName(): string {
    return this.displayName || 'Anonymous User';
  }

  isComplete(): boolean {
    return !!(this.displayName && this.bio && this.country);
  }

  getAge(): number | null {
    if (!this.birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - this.birthDate.getFullYear();
    const monthDiff = today.getMonth() - this.birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  isUnderage(): boolean {
    const age = this.getAge();
    return age !== null && age < 18;
  }
}