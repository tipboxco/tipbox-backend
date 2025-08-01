export class UserAvatar {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly imageUrl: string,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isCurrentlyActive(): boolean {
    return this.isActive;
  }

  getImageUrl(): string {
    return this.imageUrl;
  }

  getThumbnailUrl(size: number = 150): string {
    // If using a cloud storage service, could add size parameters
    return this.imageUrl; // For now return original
  }

  isRecentlyUploaded(): boolean {
    const daysSinceUpload = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpload <= 1; // Uploaded within last day
  }

  isValidImageUrl(): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const lowerUrl = this.imageUrl.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
           lowerUrl.includes('image') || 
           lowerUrl.includes('avatar');
  }

  getFileExtension(): string | null {
    const match = this.imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : null;
  }

  isProfilePicture(): boolean {
    return this.isActive && this.isValidImageUrl();
  }
}