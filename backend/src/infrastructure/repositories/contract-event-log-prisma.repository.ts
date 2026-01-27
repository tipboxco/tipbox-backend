import { getPrisma } from './prisma.client';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateContractEventLogData {
  chainId: number;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  decodedLog: Record<string, any>;
  topics: string[];
  data?: string | null;
  timestamp: Date;
  rawPayload: Record<string, any>;
  transactionId?: string | null;
  walletId?: string | null;
  processed?: boolean;
}

export interface UpdateContractEventLogData {
  transactionId?: string | null;
  walletId?: string | null;
  processed?: boolean;
  processedAt?: Date | null;
}

export interface ContractEventLogFilters {
  chainId?: number;
  contractAddress?: string;
  eventName?: string;
  transactionHash?: string;
  walletId?: string;
  processed?: boolean;
  fromBlock?: number;
  toBlock?: number;
  fromDate?: Date;
  toDate?: Date;
}

export interface ContractEventLogRecord {
  id: string;
  chainId: number;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  decodedLog: any;
  topics: string[];
  data: string | null;
  timestamp: Date;
  rawPayload: any;
  transactionId: string | null;
  walletId: string | null;
  processed: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class ContractEventLogPrismaRepository {
  private readonly prisma = getPrisma();

  /**
   * Yeni event log oluşturur
   */
  async create(data: CreateContractEventLogData): Promise<ContractEventLogRecord> {
    return this.prisma.contractEventLog.create({
      data: {
        chainId: data.chainId,
        contractAddress: data.contractAddress.toLowerCase(),
        blockNumber: data.blockNumber,
        transactionHash: data.transactionHash.toLowerCase(),
        transactionIndex: data.transactionIndex,
        logIndex: data.logIndex,
        eventName: data.eventName,
        decodedLog: data.decodedLog,
        topics: data.topics,
        data: data.data ?? null,
        timestamp: data.timestamp,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? null,
        walletId: data.walletId ?? null,
        processed: data.processed ?? false,
        processedAt: data.processed ? new Date() : null
      }
    });
  }

  /**
   * ID ile event log bulur
   */
  async findById(id: string): Promise<ContractEventLogRecord | null> {
    return this.prisma.contractEventLog.findUnique({
      where: { id }
    });
  }

  /**
   * Transaction hash ve log index ile event log bulur (unique)
   */
  async findByHashAndLogIndex(transactionHash: string, logIndex: number): Promise<ContractEventLogRecord | null> {
    return this.prisma.contractEventLog.findUnique({
      where: {
        transactionHash_logIndex: {
          transactionHash: transactionHash.toLowerCase(),
          logIndex
        }
      }
    });
  }

  /**
   * Transaction hash ile tüm event logları bulur
   */
  async findByTransactionHash(transactionHash: string): Promise<ContractEventLogRecord[]> {
    return this.prisma.contractEventLog.findMany({
      where: { transactionHash: transactionHash.toLowerCase() },
      orderBy: { logIndex: 'asc' }
    });
  }

  /**
   * Contract adresi ve event name ile event logları bulur
   */
  async findByContractAndEvent(
    contractAddress: string,
    eventName: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<ContractEventLogRecord[]> {
    return this.prisma.contractEventLog.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        eventName
      },
      orderBy: { blockNumber: 'desc' },
      take: options?.limit || 50,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });
  }

  /**
   * Wallet ID ile event logları bulur
   */
  async findByWalletId(
    walletId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<ContractEventLogRecord[]> {
    return this.prisma.contractEventLog.findMany({
      where: { walletId },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 50,
      ...(options?.cursor && {
        skip: 1,
        cursor: { id: options.cursor }
      })
    });
  }

  /**
   * Event log günceller
   */
  async update(id: string, data: UpdateContractEventLogData): Promise<ContractEventLogRecord> {
    return this.prisma.contractEventLog.update({
      where: { id },
      data: {
        ...data,
        processedAt: data.processed ? new Date() : data.processedAt
      }
    });
  }

  /**
   * Event log'u işlenmiş olarak işaretle
   */
  async markAsProcessed(id: string, transactionId?: string, walletId?: string): Promise<ContractEventLogRecord> {
    return this.prisma.contractEventLog.update({
      where: { id },
      data: {
        processed: true,
        processedAt: new Date(),
        transactionId: transactionId ?? undefined,
        walletId: walletId ?? undefined
      }
    });
  }

  /**
   * Upsert - varsa güncelle, yoksa oluştur
   */
  async upsert(data: CreateContractEventLogData): Promise<ContractEventLogRecord> {
    return this.prisma.contractEventLog.upsert({
      where: {
        transactionHash_logIndex: {
          transactionHash: data.transactionHash.toLowerCase(),
          logIndex: data.logIndex
        }
      },
      create: {
        chainId: data.chainId,
        contractAddress: data.contractAddress.toLowerCase(),
        blockNumber: data.blockNumber,
        transactionHash: data.transactionHash.toLowerCase(),
        transactionIndex: data.transactionIndex,
        logIndex: data.logIndex,
        eventName: data.eventName,
        decodedLog: data.decodedLog,
        topics: data.topics,
        data: data.data ?? null,
        timestamp: data.timestamp,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? null,
        walletId: data.walletId ?? null,
        processed: data.processed ?? false,
        processedAt: data.processed ? new Date() : null
      },
      update: {
        decodedLog: data.decodedLog,
        rawPayload: data.rawPayload,
        transactionId: data.transactionId ?? undefined,
        walletId: data.walletId ?? undefined
      }
    });
  }

  /**
   * Filtrelerle event logları bulur
   */
  async findByFilters(
    filters: ContractEventLogFilters,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ items: ContractEventLogRecord[]; nextCursor?: string }> {
    const where: any = {};

    if (filters.chainId) {
      where.chainId = filters.chainId;
    }

    if (filters.contractAddress) {
      where.contractAddress = filters.contractAddress.toLowerCase();
    }

    if (filters.eventName) {
      where.eventName = filters.eventName;
    }

    if (filters.transactionHash) {
      where.transactionHash = filters.transactionHash.toLowerCase();
    }

    if (filters.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters.processed !== undefined) {
      where.processed = filters.processed;
    }

    if (filters.fromBlock !== undefined || filters.toBlock !== undefined) {
      where.blockNumber = {};
      if (filters.fromBlock !== undefined) where.blockNumber.gte = filters.fromBlock;
      if (filters.toBlock !== undefined) where.blockNumber.lte = filters.toBlock;
    }

    if (filters.fromDate || filters.toDate) {
      where.timestamp = {};
      if (filters.fromDate) where.timestamp.gte = filters.fromDate;
      if (filters.toDate) where.timestamp.lte = filters.toDate;
    }

    const limit = options?.limit || 50;

    const records = await this.prisma.contractEventLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
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
   * Son N event logunu getirir
   */
  async findRecent(limit: number = 20): Promise<ContractEventLogRecord[]> {
    return this.prisma.contractEventLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * İşlenmemiş event loglarını getirir
   */
  async findUnprocessed(limit: number = 100): Promise<ContractEventLogRecord[]> {
    return this.prisma.contractEventLog.findMany({
      where: { processed: false },
      orderBy: { timestamp: 'asc' },
      take: limit
    });
  }

  /**
   * Event name bazlı count
   */
  async countByEventName(eventName: string): Promise<number> {
    return this.prisma.contractEventLog.count({
      where: { eventName }
    });
  }

  /**
   * Contract bazlı event istatistikleri
   */
  async getEventStats(contractAddress: string): Promise<Record<string, number>> {
    const result = await this.prisma.contractEventLog.groupBy({
      by: ['eventName'],
      where: { contractAddress: contractAddress.toLowerCase() },
      _count: { eventName: true }
    });

    return result.reduce((acc, item) => {
      acc[item.eventName] = item._count.eventName;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Var olup olmadığını kontrol et
   */
  async exists(transactionHash: string, logIndex: number): Promise<boolean> {
    const count = await this.prisma.contractEventLog.count({
      where: {
        transactionHash: transactionHash.toLowerCase(),
        logIndex
      }
    });
    return count > 0;
  }

  /**
   * Eski event loglarını temizle
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.contractEventLog.deleteMany({
      where: {
        timestamp: { lt: date },
        processed: true
      }
    });
    return result.count;
  }
}
