export class ChoiceComment {
  constructor(
    public readonly id: string,
    public readonly choiceId: number,
    public readonly userId: number,
    public readonly comment: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToChoice(choiceId: number): boolean {
    return this.choiceId === choiceId;
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getComment(): string {
    return this.comment;
  }

  isValidComment(): boolean {
    return this.comment.trim().length > 0;
  }

  isDetailedComment(): boolean {
    return this.comment.split(' ').length > 10;
  }

  getWordCount(): number {
    return this.comment.split(' ').length;
  }

  generateExcerpt(maxWords: number = 20): string {
    const words = this.comment.split(' ');
    if (words.length <= maxWords) return this.comment;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  isRecentComment(): boolean {
    const daysSinceComment = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceComment <= 7;
  }

  getCommentType(): 'SUPPORT' | 'QUESTION' | 'SUGGESTION' | 'GENERAL' {
    const comment = this.comment.toLowerCase();
    if (comment.includes('katılıyorum') || comment.includes('destekliyorum') || comment.includes('haklı')) return 'SUPPORT';
    if (comment.includes('?') || comment.includes('nasıl') || comment.includes('neden')) return 'QUESTION';
    if (comment.includes('önerim') || comment.includes('belki') || comment.includes('yapılabilir')) return 'SUGGESTION';
    return 'GENERAL';
  }

  getCommentTypeDisplayName(): string {
    switch (this.getCommentType()) {
      case 'SUPPORT': return 'Destek';
      case 'QUESTION': return 'Soru';
      case 'SUGGESTION': return 'Öneri';
      case 'GENERAL': return 'Genel';
    }
  }

  getCommentIcon(): string {
    switch (this.getCommentType()) {
      case 'SUPPORT': return '👍';
      case 'QUESTION': return '❓';
      case 'SUGGESTION': return '💡';
      case 'GENERAL': return '💬';
    }
  }
}