export class UserTheme {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isDefaultTheme(): boolean {
    return this.name.toLowerCase() === 'default' || this.name.toLowerCase() === 'light';
  }

  isDarkTheme(): boolean {
    return this.name.toLowerCase().includes('dark');
  }

  isLightTheme(): boolean {
    return this.name.toLowerCase().includes('light');
  }

  isAutoTheme(): boolean {
    return this.name.toLowerCase().includes('auto') || this.name.toLowerCase().includes('system');
  }

  getDisplayName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} teması`;
  }

  getThemeIcon(): string {
    if (this.isDarkTheme()) return '🌙';
    if (this.isLightTheme()) return '☀️';
    if (this.isAutoTheme()) return '🌗';
    return '🎨';
  }

  getThemeClass(): string {
    return `theme-${this.name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  isCustomTheme(): boolean {
    const defaultThemes = ['light', 'dark', 'auto', 'default'];
    return !defaultThemes.includes(this.name.toLowerCase());
  }
}