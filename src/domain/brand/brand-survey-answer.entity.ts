export class BrandSurveyAnswer {
  constructor(
    public readonly id: number,
    public readonly questionId: number,
    public readonly userId: number,
    public readonly answerText: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToQuestion(questionId: number): boolean {
    return this.questionId === questionId;
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getAnswerText(): string {
    return this.answerText;
  }

  isDetailedAnswer(): boolean {
    return this.answerText.split(' ').length > 10;
  }

  isRecentAnswer(): boolean {
    const daysSinceAnswer = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceAnswer <= 7;
  }

  getWordCount(): number {
    return this.answerText.split(' ').length;
  }

  generateExcerpt(maxWords: number = 10): string {
    const words = this.answerText.split(' ');
    if (words.length <= maxWords) return this.answerText;
    return words.slice(0, maxWords).join(' ') + '...';
  }
}