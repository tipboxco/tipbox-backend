import { getPrisma } from './prisma.client';
import { ThirdwebWebhookStatus, ThirdwebOnchainStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateThirdwebWebhookLogData {
  queueId: string;
  status: ThirdwebWebhookStatus;
  onchainStatus?: ThirdwebOnchainStatus | null;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  functionName?: string | null;
  functionArgs?: string | null;
  errorMessage?: string | null;
  rawPayload: Record<string, any>;
  transactionId?: string | null;
}

export interface UpdateThirdwebWebhookLogData {
  status?: ThirdwebWebhookStatus;
  onchainStatus?: ThirdwebOnchainStatus | null;
  transactionHash?: string | null;
  blockNumber?: number | null;
  errorMessage?: string | null;
  rawPayload?: Record<string, any>;
  transactionId?: string | null;
  processedAt?: Date;
}

export interface ThirdwebWebhookLogFilters {
  status?: ThirdwebWebhookStatus;
  transactionHash?: string;
  transactionId?: string;
  fromAddress?: string;
  toAddress?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface ThirdwebWebhookLogRecord {
  id: string;
  queueId: string;
  status: ThirdwebWebhookStatus;
  onchainStatus: ThirdwebOnchainStatus | null;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  transactionHash: string | null;
  blockNumber: number | null;
  functionName: string | null;
  functionArgs: string | null;
  errorMessage: string | null;
  rawPayload: any;
  transactionId: string | null;
  processedAt: Date;
  createdAt: Date;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class ThirdwebWebhookLogPrismaRepository {
  private readonly prisma = getPrisma();

  /**
   * Yeni webhook log oluşturur
   */
  async create(data: CreateThirdwebWebhookLogData): Promise<ThirdwebWebhookLogRecord> {
    const record = await this.prisma.thirdwebWebhookLog.create({
      data: {
        queueId: data.queueId,
        status: data.status,
        onchainStatus: data.onchainStatus ?? null,
        chainId: data.chainId,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        transactionHash: data.transactionHash ?? null,
        blockNumber: data.blockNumber ?? null,
        functionName: data.functionName ?? null,
        functionArgs: data.functionArgs ?? null,
        errorMessage: data.errorMessage ?? null,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? null,
        processedAt: new Date()
      }
    });

    return record;
  }

  /**
   * ID ile webhook log bulur
   */
  async findById(id: string): Promise<ThirdwebWebhookLogRecord | null> {
    return this.prisma.thirdwebWebhookLog.findUnique({
      where: { id }
    });
  }

  /**
   * Queue ID ile webhook log bulur
   */
  async findByQueueId(queueId: string): Promise<ThirdwebWebhookLogRecord | null> {
    return this.prisma.thirdwebWebhookLog.findUnique({
      where: { queueId }
    });
  }

  /**
   * Transaction hash ile webhook logları bulur
   */
  async findByTransactionHash(transactionHash: string): Promise<ThirdwebWebhookLogRecord[]> {
    return this.prisma.thirdwebWebhookLog.findMany({
      where: { transactionHash },
      orderBy: { processedAt: 'desc' }
    });
  }

  /**
   * Internal transaction ID ile webhook logları bulur
   */
  async findByTransactionId(transactionId: string): Promise<ThirdwebWebhookLogRecord[]> {
    return this.prisma.thirdwebWebhookLog.findMany({
      where: { transactionId },
      orderBy: { processedAt: 'desc' }
    });
  }

  /**
   * Wallet adresi ile webhook logları bulur
   */
  async findByWalletAddress(
    address: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<ThirdwebWebhookLogRecord[]> {
    return this.prisma.thirdwebWebhookLog.findMany({
      where: {
        OR: [
          { fromAddress: address },
          { toAddress: address }
        ]
      },
      orderBy: { processedAt: 'desc' },
      take: options?.limit || 50,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });
  }

  /**
   * Webhook log günceller
   */
  async update(id: string, data: UpdateThirdwebWebhookLogData): Promise<ThirdwebWebhookLogRecord> {
    return this.prisma.thirdwebWebhookLog.update({
      where: { id },
      data: {
        ...data,
        processedAt: data.processedAt ?? new Date()
      }
    });
  }

  /**
   * Queue ID ile upsert (varsa güncelle, yoksa oluştur)
   */
  async upsertByQueueId(data: CreateThirdwebWebhookLogData): Promise<ThirdwebWebhookLogRecord> {
    return this.prisma.thirdwebWebhookLog.upsert({
      where: { queueId: data.queueId },
      create: {
        queueId: data.queueId,
        status: data.status,
        onchainStatus: data.onchainStatus ?? null,
        chainId: data.chainId,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        transactionHash: data.transactionHash ?? null,
        blockNumber: data.blockNumber ?? null,
        functionName: data.functionName ?? null,
        functionArgs: data.functionArgs ?? null,
        errorMessage: data.errorMessage ?? null,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? null,
        processedAt: new Date()
      },
      update: {
        status: data.status,
        onchainStatus: data.onchainStatus ?? null,
        transactionHash: data.transactionHash ?? null,
        blockNumber: data.blockNumber ?? null,
        errorMessage: data.errorMessage ?? null,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? null,
        processedAt: new Date()
      }
    });
  }

  /**
   * Filtrelerle webhook logları bulur
   */
  async findByFilters(
    filters: ThirdwebWebhookLogFilters,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ items: ThirdwebWebhookLogRecord[]; nextCursor?: string }> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.transactionHash) {
      where.transactionHash = filters.transactionHash;
    }

    if (filters.transactionId) {
      where.transactionId = filters.transactionId;
    }

    if (filters.fromAddress) {
      where.fromAddress = filters.fromAddress;
    }

    if (filters.toAddress) {
      where.toAddress = filters.toAddress;
    }

    if (filters.fromDate || filters.toDate) {
      where.processedAt = {};
      if (filters.fromDate) where.processedAt.gte = filters.fromDate;
      if (filters.toDate) where.processedAt.lte = filters.toDate;
    }

    const limit = options?.limit || 50;

    const records = await this.prisma.thirdwebWebhookLog.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      take: limit + 1,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });

    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }

  /**
   * Son N webhook logunu getirir
   */
  async findRecent(limit: number = 20): Promise<ThirdwebWebhookLogRecord[]> {
    return this.prisma.thirdwebWebhookLog.findMany({
      orderBy: { processedAt: 'desc' },
      take: limit
    });
  }

  /**
   * Belirli bir status'taki webhook sayısını döndürür
   */
  async countByStatus(status: ThirdwebWebhookStatus): Promise<number> {
    return this.prisma.thirdwebWebhookLog.count({
      where: { status }
    });
  }

  /**
   * Queue ID'nin var olup olmadığını kontrol eder
   */
  async existsByQueueId(queueId: string): Promise<boolean> {
    const count = await this.prisma.thirdwebWebhookLog.count({
      where: { queueId }
    });
    return count > 0;
  }

  /**
   * Eski webhook loglarını temizler
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.thirdwebWebhookLog.deleteMany({
      where: {
        processedAt: { lt: date }
      }
    });
    return result.count;
  }
}
