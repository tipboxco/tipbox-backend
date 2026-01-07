export enum UserReportCategory {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  SCAM = 'SCAM',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  FAKE_ACCOUNT = 'FAKE_ACCOUNT',
  OTHER = 'OTHER',
}

export const USER_REPORT_CATEGORY_LABELS: Record<UserReportCategory, string> = {
  [UserReportCategory.SPAM]: 'Spam',
  [UserReportCategory.HARASSMENT]: 'Taciz',
  [UserReportCategory.SCAM]: 'Dolandırıcılık',
  [UserReportCategory.INAPPROPRIATE_CONTENT]: 'Uygunsuz İçerik',
  [UserReportCategory.FAKE_ACCOUNT]: 'Sahte Hesap',
  [UserReportCategory.OTHER]: 'Diğer',
};

