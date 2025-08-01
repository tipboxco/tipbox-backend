export class BadgeCategory {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null
  ) {}

  // Essential business methods only
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} kategorisi`;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }
}