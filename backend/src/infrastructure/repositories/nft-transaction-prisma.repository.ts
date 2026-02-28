import type { NFTTransaction as PrismaNFTTransactionModel } from '@prisma/client';
import { getPrisma } from './prisma.client';
import { NFTTransaction } from '../../domain/crypto/nft-transaction.entity';
import { NFTTransactionType } from '../../domain/crypto/nft-transaction-type.enum';

export interface NFTSaleHistoryItem {
  id: string;
  nftId: string;
  fromUserId: string;
  toUserId: string;
  price: number;
  createdAt: Date;
}

export class NFTTransactionPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<NFTTransaction | null> {
    const transaction = await this.prisma.nFTTransaction.findUnique({
      where: { id },
    });
    return transaction ? this.toDomain(transaction) : null;
  }

  async findByNftId(nftId: string): Promise<NFTTransaction[]> {
    const transactions = await this.prisma.nFTTransaction.findMany({
      where: { nftId },
      orderBy: { createdAt: 'desc' },
    });
    return transactions.map((t) => this.toDomain(t));
  }

  /**
   * Get purchase history for an NFT (only PURCHASE transactions with price)
   */
  async findPurchaseHistoryByNftId(nftId: string): Promise<NFTSaleHistoryItem[]> {
    const purchases = await this.prisma.nFTTransaction.findMany({
      where: {
        nftId,
        transactionType: NFTTransactionType.PURCHASE,
        price: { not: null },
        fromUserId: { not: null },  // ✨ fromUserId null olmamalı (satıcı olmalı)
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nftId: true,
        fromUserId: true,
        toUserId: true,
        price: true,
        createdAt: true,
      },
    });

    return purchases.map((p) => ({
      id: p.id,
      nftId: p.nftId,
      fromUserId: p.fromUserId!,
      toUserId: p.toUserId,
      price: p.price!,
      createdAt: p.createdAt,
    }));
  }

  async create(
    nftId: string,
    fromUserId: string | null,
    toUserId: string,
    price: number | null,
    transactionType: NFTTransactionType
  ): Promise<NFTTransaction> {
    const transaction = await this.prisma.nFTTransaction.create({
      data: {
        nftId,
        fromUserId,
        toUserId,
        price,
        transactionType,
      },
    });
    return this.toDomain(transaction);
  }

  private toDomain(prismaTransaction: PrismaNFTTransactionModel): NFTTransaction {
    return new NFTTransaction(
      prismaTransaction.id,
      prismaTransaction.nftId,
      prismaTransaction.fromUserId,
      prismaTransaction.toUserId,
      prismaTransaction.price,
      prismaTransaction.transactionType as NFTTransactionType,
      prismaTransaction.createdAt,
      prismaTransaction.updatedAt
    );
  }
}
