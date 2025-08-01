import { QuestionAnswerFormat } from './question-answer-format.enum';

export class PostQuestion {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly expectedAnswerFormat: QuestionAnswerFormat,
    public readonly relatedProductId: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  hasRelatedProduct(): boolean {
    return this.relatedProductId !== null;
  }

  expectsShortAnswer(): boolean {
    return this.expectedAnswerFormat === QuestionAnswerFormat.SHORT;
  }

  expectsLongAnswer(): boolean {
    return this.expectedAnswerFormat === QuestionAnswerFormat.LONG;
  }

  isPoll(): boolean {
    return this.expectedAnswerFormat === QuestionAnswerFormat.POLL;
  }

  isMultipleChoice(): boolean {
    return this.expectedAnswerFormat === QuestionAnswerFormat.CHOICE;
  }

  getAnswerFormatDisplayName(): string {
    switch (this.expectedAnswerFormat) {
      case QuestionAnswerFormat.SHORT: return 'Kısa Cevap';
      case QuestionAnswerFormat.LONG: return 'Detaylı Cevap';
      case QuestionAnswerFormat.POLL: return 'Anket';
      case QuestionAnswerFormat.CHOICE: return 'Çoktan Seçmeli';
    }
  }
}