export class UserTitle {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly title: string,
    public readonly earnedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getDisplayTitle(): string {
    return this.title;
  }

  isRecentlyEarned(): boolean {
    const daysSinceEarned = Math.floor(
      (Date.now() - this.earnedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceEarned <= 7; // Earned within last week
  }

  isPrestigious(): boolean {
    const prestigiousTitles = [
      'Expert', 'Master', 'Legend', 'Champion', 'Elite', 
      'Guru', 'Pro', 'Veteran', 'Pioneer', 'Icon'
    ];
    return prestigiousTitles.some(prestigious => 
      this.title.toLowerCase().includes(prestigious.toLowerCase())
    );
  }

  isAchievementTitle(): boolean {
    const achievementKeywords = [
      'Winner', 'Champion', 'Master', 'Expert', 'Pro',
      'Veteran', 'Pioneer', 'Specialist', 'Guru'
    ];
    return achievementKeywords.some(keyword => 
      this.title.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  isRoleTitle(): boolean {
    const roleTitles = [
      'Moderator', 'Admin', 'Helper', 'Supporter', 
      'Ambassador', 'Community Manager'
    ];
    return roleTitles.some(role => 
      this.title.toLowerCase().includes(role.toLowerCase())
    );
  }

  getTitleCategory(): 'ACHIEVEMENT' | 'ROLE' | 'SPECIAL' | 'GENERAL' {
    if (this.isRoleTitle()) return 'ROLE';
    if (this.isAchievementTitle()) return 'ACHIEVEMENT';
    if (this.isPrestigious()) return 'SPECIAL';
    return 'GENERAL';
  }

  getTitleColor(): string {
    switch (this.getTitleCategory()) {
      case 'ROLE': return '#dc2626';      // Red
      case 'ACHIEVEMENT': return '#059669'; // Green
      case 'SPECIAL': return '#7c3aed';   // Purple
      case 'GENERAL': return '#6b7280';   // Gray
    }
  }

  getTitleIcon(): string {
    switch (this.getTitleCategory()) {
      case 'ROLE': return '👑';
      case 'ACHIEVEMENT': return '🏆';
      case 'SPECIAL': return '⭐';
      case 'GENERAL': return '🏷️';
    }
  }

  getDaysEarned(): number {
    return Math.floor(
      (Date.now() - this.earnedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}