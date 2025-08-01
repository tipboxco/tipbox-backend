export class UserRole {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly role: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  isModerator(): boolean {
    return this.role === 'MODERATOR';
  }

  isUser(): boolean {
    return this.role === 'USER';
  }

  hasElevatedPrivileges(): boolean {
    return this.isAdmin() || this.isModerator();
  }

  canModerateContent(): boolean {
    return this.isAdmin() || this.isModerator();
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }

  getRoleDisplayName(): string {
    switch (this.role) {
      case 'ADMIN': return 'Administrator';
      case 'MODERATOR': return 'Moderator';
      case 'USER': return 'User';
      default: return this.role;
    }
  }

  getRoleBadgeColor(): string {
    switch (this.role) {
      case 'ADMIN': return '#dc2626';     // Red
      case 'MODERATOR': return '#7c3aed'; // Purple
      case 'USER': return '#6b7280';      // Gray
      default: return '#6b7280';
    }
  }
}