export class InventoryMedia {
  constructor(
    public readonly id: string,
    public readonly inventoryId: string,
    public readonly mediaUrl: string,
    public readonly uploadedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getMediaUrl(): string {
    return this.mediaUrl;
  }

  belongsToInventory(inventoryId: string): boolean {
    return this.inventoryId === inventoryId;
  }

  isRecentUpload(): boolean {
    const daysSinceUpload = Math.floor(
      (Date.now() - this.uploadedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpload <= 7;
  }

  getFileExtension(): string | null {
    const match = this.mediaUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : null;
  }

  isValidMediaUrl(): boolean {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const ext = this.getFileExtension();
      return ext ? imageExtensions.includes(ext) : false;
  }

  getMediaIcon(): string {
    return '📷';
  }
}