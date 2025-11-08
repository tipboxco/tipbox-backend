export class ScenarioChoice {
  constructor(
    public readonly id: string,
    public readonly scenarioId: number,
    public readonly userId: number,
    public readonly choiceText: string,
    public readonly isSelected: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToScenario(scenarioId: number): boolean {
    return this.scenarioId === scenarioId;
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getChoiceText(): string {
    return this.choiceText;
  }

  isSelectedChoice(): boolean {
    return this.isSelected;
  }

  isValidChoice(): boolean {
    return this.choiceText.trim().length > 0;
  }

  isDetailedChoice(): boolean {
    return this.choiceText.split(' ').length > 10;
  }

  getWordCount(): number {
    return this.choiceText.split(' ').length;
  }

  generateExcerpt(maxWords: number = 15): string {
    const words = this.choiceText.split(' ');
    if (words.length <= maxWords) return this.choiceText;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  isRecentChoice(): boolean {
    const daysSinceChoice = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceChoice <= 7;
  }

  getChoiceQuality(): 'BASIC' | 'DETAILED' | 'COMPREHENSIVE' {
    const wordCount = this.getWordCount();
    if (wordCount >= 30) return 'COMPREHENSIVE';
    if (wordCount >= 10) return 'DETAILED';
    return 'BASIC';
  }

  getChoiceQualityDisplayName(): string {
    switch (this.getChoiceQuality()) {
      case 'BASIC': return 'Temel';
      case 'DETAILED': return 'Detaylı';
      case 'COMPREHENSIVE': return 'Kapsamlı';
    }
  }

  getChoiceIcon(): string {
    if (this.isSelectedChoice()) return '✅';
    return '💭';
  }
}