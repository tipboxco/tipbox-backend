export enum SupportRequestReportCategory {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  SCAM = 'SCAM',
}

export const SUPPORT_REQUEST_REPORT_CATEGORY_LABELS: Record<SupportRequestReportCategory, string> = {
  [SupportRequestReportCategory.SPAM]: 'Spam / İstenmeyen İçerik',
  [SupportRequestReportCategory.HARASSMENT]: 'Taciz / Uygunsuz Davranış',
  [SupportRequestReportCategory.SCAM]: 'Dolandırıcılık / Scam',
};

