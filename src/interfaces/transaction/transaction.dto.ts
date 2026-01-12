export interface SendTipRequest {
  recipientId?: string;      // User ID (internal transfer için)
  walletAddress?: string;    // Wallet address (external wallet için)
  amount: number;
  message?: string;          // Opsiyonel mesaj
  reason?: string;           // Backward compatibility için (message ile aynı)
}

export interface TransactionResponse {
  id: string;
  actionType: string;
  status: string;
  amount: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  metadata: Record<string, any> | null;
  txHash: string | null;
  provider: string;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
}

export interface TransactionHistoryItem {
  id: string;
  type: 'sent' | 'received';
  actionType: string;
  amount: number | null;
  currency: string;
  from: {
    id: string;
    name: string;
    avatar: string | null;
    walletAddress: string | null;
  } | null;
  to: {
    id: string;
    name: string;
    avatar: string | null;
    walletAddress: string | null;
  } | null;
  reason: string | null;
  status: string;
  createdAt: string;
}

