import { SurveyQuestionType } from './survey-question-type.enum';

export class BrandSurveyQuestion {
  constructor(
    public readonly id: number,
    public readonly surveyId: number,
    public readonly questionText: string,
    public readonly type: SurveyQuestionType,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToSurvey(surveyId: number): boolean {
    return this.surveyId === surveyId;
  }

  getQuestionText(): string {
    return this.questionText;
  }

  isSingleChoice(): boolean {
    return this.type === SurveyQuestionType.SINGLE_CHOICE;
  }

  isMultipleChoice(): boolean {
    return this.type === SurveyQuestionType.MULTIPLE_CHOICE;
  }

  isTextQuestion(): boolean {
    return this.type === SurveyQuestionType.TEXT;
  }

  getTypeDisplayName(): string {
    switch (this.type) {
      case SurveyQuestionType.SINGLE_CHOICE: return 'Tek Seçimli';
      case SurveyQuestionType.MULTIPLE_CHOICE: return 'Çoklu Seçim';
      case SurveyQuestionType.TEXT: return 'Metin';
    }
  }

  getTypeIcon(): string {
    switch (this.type) {
      case SurveyQuestionType.SINGLE_CHOICE: return '⚪';
      case SurveyQuestionType.MULTIPLE_CHOICE: return '☑️';
      case SurveyQuestionType.TEXT: return '📝';
    }
  }

  requiresChoices(): boolean {
    return this.isSingleChoice() || this.isMultipleChoice();
  }

  allowsMultipleAnswers(): boolean {
    return this.isMultipleChoice();
  }
}