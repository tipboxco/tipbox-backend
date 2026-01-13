export class UserFeedPreferences {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly preferredCategories: string | null,
    public readonly preferredContentTypes: string | null,
    public readonly language: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getPreferredCategoriesArray(): string[] {
    return this.preferredCategories ? this.preferredCategories.split(',') : [];
  }

  getPreferredContentTypesArray(): string[] {
    return this.preferredContentTypes ? this.preferredContentTypes.split(',') : [];
  }

  getEffectiveLanguage(): string {
    return this.language ?? 'tr'; // Default to Turkish
  }

  hasPreferences(): boolean {
    return !!(this.preferredCategories || this.preferredContentTypes || this.language);
  }

  isCategoryPreferred(categoryId: string): boolean {
    const categories = this.getPreferredCategoriesArray();
    return categories.includes(categoryId);
  }

  isContentTypePreferred(contentType: string): boolean {
    const types = this.getPreferredContentTypesArray();
    return types.includes(contentType);
  }

  addPreferredCategory(categoryId: string): string {
    const categories = this.getPreferredCategoriesArray();
    if (!categories.includes(categoryId)) {
      categories.push(categoryId);
    }
    return categories.join(',');
  }

  removePreferredCategory(categoryId: string): string {
    const categories = this.getPreferredCategoriesArray();
    const filtered = categories.filter(id => id !== categoryId);
    return filtered.join(',');
  }

  addPreferredContentType(contentType: string): string {
    const types = this.getPreferredContentTypesArray();
    if (!types.includes(contentType)) {
      types.push(contentType);
    }
    return types.join(',');
  }

  removePreferredContentType(contentType: string): string {
    const types = this.getPreferredContentTypesArray();
    const filtered = types.filter(type => type !== contentType);
    return filtered.join(',');
  }
}