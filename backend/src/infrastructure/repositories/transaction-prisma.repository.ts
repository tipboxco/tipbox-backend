import { Prisma } from '@prisma/client';
import type { Transaction as PrismaTransactionModel } from '@prisma/client';
import { Transaction } from '../../domain/transaction/transaction.entity';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { getPrisma } from './prisma.client';

export interface CreateTransactionData {
  walletId: string;
  actionType: TransactionActionType;
  amount: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  metadata?: Prisma.InputJsonValue | null;
  provider?: string;
}

export interface TransactionFilters {
  walletId?: string;
  userId?: string;
  status?: TransactionStatus;
  actionType?: TransactionActionType;
  fromDate?: Date;
  toDate?: Date;
  /** Kullanıcı cüzdan listesinde iptal edilmiş TIP_RECEIVE kayıtları gösterilmesin */
  excludeCancelledTipReceive?: boolean;
}

export class TransactionPrismaRepository {
  private readonly prisma = getPrisma();

  async create(data: CreateTransactionData): Promise<Transaction> {
    const record = await this.prisma.transaction.create({
      data: {
        walletId: data.walletId,
        actionType: data.actionType,
        status: TransactionStatus.CREATED,
        amount: data.amount,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        metadata: data.metadata ?? {},
        txHash: null,
        provider: data.provider || 'backend',
        errorMessage: null,
        confirmedAt: null,
        failedAt: null
      }
    });

    return this.mapToEntity(record);
  }

  async findById(id: string): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({
      where: { id }
    });

    return record ? this.mapToEntity(record) : null;
  }

  async findByWalletId(
    walletId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<Transaction[]> {
    const records = await this.prisma.transaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });

    return records.map(r => this.mapToEntity(r));
  }

  async findByFilters(
    filters: TransactionFilters,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ items: Transaction[]; nextCursor?: string }> {
    const where: Prisma.TransactionWhereInput = {};

    if (filters.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters.userId) {
      where.wallet = { userId: filters.userId };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.actionType) {
      where.actionType = filters.actionType;
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    if (filters.excludeCancelledTipReceive) {
      where.NOT = {
        AND: [
          { actionType: TransactionActionType.TIP_RECEIVE },
          { status: TransactionStatus.FAILED },
          { errorMessage: 'Cancelled by user' }
        ]
      };
    }

    const limit = (options?.limit || 50) + 1; // +1 to check if there's more

    const records = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });

    const hasMore = records.length === limit;
    const items = hasMore ? records.slice(0, -1) : records;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return {
      items: items.map(r => this.mapToEntity(r)),
      nextCursor
    };
  }

  async findPendingTransactions(limit: number = 100): Promise<Transaction[]> {
    const records = await this.prisma.transaction.findMany({
      where: {
        status: {
          in: [TransactionStatus.CREATED, TransactionStatus.PENDING]
        }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    return records.map(r => this.mapToEntity(r));
  }

  /** Aynı on-chain txHash'e sahip tüm transaction'ları döner (tip send/receive çifti için). Hash 0x ile veya olmadan saklanmış olabilir. */
  async findByTxHash(txHash: string): Promise<Transaction[]> {
    const raw = (txHash ?? '').trim();
    if (!raw) return [];
    const lower = raw.toLowerCase();
    const normalized = lower.startsWith('0x') ? lower : `0x${lower}`;
    const withoutPrefix = normalized.startsWith('0x') ? normalized.slice(2) : normalized;
    const records = await this.prisma.transaction.findMany({
      where: {
        OR: [{ txHash: normalized }, { txHash: withoutPrefix }, { txHash: raw }]
      },
      orderBy: { createdAt: 'asc' }
    });
    return records.map(r => this.mapToEntity(r));
  }

  /** Sadece metadata günceller (tip send/receive eşleşmesi için). */
  async updateMetadata(id: string, metadata: Prisma.InputJsonValue): Promise<Transaction | null> {
    const record = await this.prisma.transaction.update({
      where: { id },
      data: { metadata }
    });
    return this.mapToEntity(record);
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    data?: { errorMessage?: string; txHash?: string }
  ): Promise<Transaction | null> {
    const updateData: Prisma.TransactionUpdateInput = { status };

    if (status === TransactionStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (status === TransactionStatus.FAILED) {
      updateData.failedAt = new Date();
      if (data?.errorMessage) {
        updateData.errorMessage = data.errorMessage;
      }
    }

    if (data?.txHash) {
      updateData.txHash = data.txHash;
    }

    const record = await this.prisma.transaction.update({
      where: { id },
      data: updateData
    });

    return this.mapToEntity(record);
  }

  async calculateBalance(walletId: string): Promise<number> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        walletId,
        status: TransactionStatus.CONFIRMED,
        amount: { not: null }
      }
    });

    let balance = 0;
    for (const tx of transactions) {
      if (!tx.amount) continue;

      // RECEIVE types add to balance
      if ([
        TransactionActionType.TIP_RECEIVE,
        TransactionActionType.CLAIM_REWARD,
        TransactionActionType.CLAIM_BADGE,
        TransactionActionType.NFT_SELL,
        TransactionActionType.SWAP_SOL_TO_TIP,
        TransactionActionType.AIRDROP
      ].includes(tx.actionType as TransactionActionType)) {
        balance += tx.amount;
      }
      // SEND types subtract from balance
      else if ([
        TransactionActionType.TIP_SEND,
        TransactionActionType.NFT_BUY,
        TransactionActionType.SWAP_TIP_TO_SOL,
        TransactionActionType.FEE
      ].includes(tx.actionType as TransactionActionType)) {
        balance -= tx.amount;
      }
    }

    return Math.max(0, balance); // Never negative
  }

  private mapToEntity(record: PrismaTransactionModel): Transaction {
    return new Transaction(
      record.id,
      record.walletId,
      record.actionType as TransactionActionType,
      record.status as TransactionStatus,
      record.amount,
      record.fromAddress,
      record.toAddress,
      record.metadata as Record<string, unknown> | null,
      record.txHash,
      record.provider,
      record.errorMessage,
      record.createdAt,
      record.confirmedAt,
      record.failedAt
    );
  }
}

