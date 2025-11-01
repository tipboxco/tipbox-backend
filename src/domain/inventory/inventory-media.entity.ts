import { InventoryMediaType } from './inventory-media-type.enum';

export class InventoryMedia {
  constructor(
    public readonly id: string,
    public readonly inventoryId: string,
    public readonly mediaUrl: string,
    public readonly type: InventoryMediaType,
    public readonly uploadedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getMediaUrl(): string {
    return this.mediaUrl;
  }

  isImage(): boolean {
    return this.type === InventoryMediaType.IMAGE;
  }

  isVideo(): boolean {
    return this.type === InventoryMediaType.VIDEO;
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
    if (this.isImage()) {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const ext = this.getFileExtension();
      return ext ? imageExtensions.includes(ext) : false;
    }
    
    if (this.isVideo()) {
      const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
      const ext = this.getFileExtension();
      return ext ? videoExtensions.includes(ext) : false;
    }
    
    return false;
  }

  getMediaIcon(): string {
    return this.isImage() ? '📷' : '🎥';
  }
}