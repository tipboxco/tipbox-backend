import { TransactionActionType } from './transaction-action-type.enum';
import { TransactionStatus } from './transaction-status.enum';

export class Transaction {
  constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly actionType: TransactionActionType,
    public status: TransactionStatus,
    public readonly amount: number | null,
    public readonly fromAddress: string | null,
    public readonly toAddress: string | null,
    public readonly metadata: Record<string, any> | null,
    public readonly txHash: string | null,
    public readonly provider: string,
    public readonly errorMessage: string | null,
    public readonly createdAt: Date,
    public readonly confirmedAt: Date | null,
    public readonly failedAt: Date | null
  ) {}

  // Business methods
  isCompleted(): boolean {
    return this.status === TransactionStatus.CONFIRMED || this.status === TransactionStatus.FAILED;
  }

  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  isSuccess(): boolean {
    return this.status === TransactionStatus.CONFIRMED;
  }

  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  isSend(): boolean {
    return [
      TransactionActionType.TIP_SEND,
      TransactionActionType.NFT_BUY,
      TransactionActionType.SWAP_TIP_TO_SOL,
      TransactionActionType.FEE
    ].includes(this.actionType);
  }

  isReceive(): boolean {
    return [
      TransactionActionType.TIP_RECEIVE,
      TransactionActionType.CLAIM_REWARD,
      TransactionActionType.CLAIM_BADGE,
      TransactionActionType.NFT_SELL,
      TransactionActionType.SWAP_SOL_TO_TIP,
      TransactionActionType.AIRDROP
    ].includes(this.actionType);
  }

  getBalanceImpact(): number {
    if (!this.amount || this.status !== TransactionStatus.CONFIRMED) {
      return 0;
    }
    return this.isReceive() ? this.amount : -this.amount;
  }

  belongsToWallet(walletId: string): boolean {
    return this.walletId === walletId;
  }

  markAsPending(): void {
    this.status = TransactionStatus.PENDING;
  }

  markAsConfirmed(): void {
    this.status = TransactionStatus.CONFIRMED;
  }

  markAsFailed(errorMessage: string): void {
    this.status = TransactionStatus.FAILED;
  }

  toJSON() {
    return {
      id: this.id,
      walletId: this.walletId,
      actionType: this.actionType,
      status: this.status,
      amount: this.amount,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      metadata: this.metadata,
      txHash: this.txHash,
      provider: this.provider,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt.toISOString(),
      confirmedAt: this.confirmedAt?.toISOString() || null,
      failedAt: this.failedAt?.toISOString() || null
    };
  }
}

