export enum ExpertRequestStatus {
  PENDING = 'PENDING',
  BROADCASTING = 'BROADCASTING', // Uzmanlar aranıyor
  EXPERT_FOUND = 'EXPERT_FOUND', // Uzman bulundu ama henüz cevap verilmedi
  ANSWERED = 'ANSWERED',
  CLOSED = 'CLOSED',
}

