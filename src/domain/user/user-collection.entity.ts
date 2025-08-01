export class UserCollection {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getDisplayName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} koleksiyonu`;
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Created within last week
  }

  isPersonalCollection(): boolean {
    const personalKeywords = [
      'favorite', 'favori', 'wishlist', 'istek', 'personal', 'kişisel',
      'my', 'benim', 'private', 'özel'
    ];
    return personalKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  isPublicCollection(): boolean {
    const publicKeywords = [
      'public', 'shared', 'paylaşılan', 'genel', 'community', 'topluluk'
    ];
    return publicKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  isWishlistCollection(): boolean {
    const wishlistKeywords = ['wishlist', 'istek', 'want', 'istiyorum'];
    return wishlistKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  isFavoriteCollection(): boolean {
    const favoriteKeywords = ['favorite', 'favori', 'fav', 'loved', 'sevdiklerim'];
    return favoriteKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  getCollectionType(): 'WISHLIST' | 'FAVORITES' | 'PERSONAL' | 'PUBLIC' | 'GENERAL' {
    if (this.isWishlistCollection()) return 'WISHLIST';
    if (this.isFavoriteCollection()) return 'FAVORITES';
    if (this.isPublicCollection()) return 'PUBLIC';
    if (this.isPersonalCollection()) return 'PERSONAL';
    return 'GENERAL';
  }

  getCollectionIcon(): string {
    switch (this.getCollectionType()) {
      case 'WISHLIST': return '⭐';
      case 'FAVORITES': return '❤️';
      case 'PUBLIC': return '🌍';
      case 'PERSONAL': return '🔒';
      case 'GENERAL': return '📁';
    }
  }

  getCollectionColor(): string {
    switch (this.getCollectionType()) {
      case 'WISHLIST': return '#f59e0b';   // Yellow
      case 'FAVORITES': return '#ef4444';  // Red
      case 'PUBLIC': return '#3b82f6';     // Blue
      case 'PERSONAL': return '#6b7280';   // Gray
      case 'GENERAL': return '#8b5cf6';    // Purple
    }
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}