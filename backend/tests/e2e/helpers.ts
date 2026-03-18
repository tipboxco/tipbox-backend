/**
 * E2E Test Helpers
 *
 * Test kullanıcıları, wallet'ları ve transaction'ları oluşturmak için yardımcı fonksiyonlar.
 * DB'ye doğrudan yazarak gerçek service katmanını test eder (Thirdweb SDK ve Redis mock'lanır).
 */

import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from '../../src/infrastructure/repositories/prisma.client';
import { TransactionActionType } from '../../src/domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../src/domain/transaction/transaction-status.enum';

// ============================================================================
// TYPES
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
}

export interface TestWallet {
  id: string;
  userId: string;
  publicAddress: string;
  smartAccountAddress: string;
  balance: number;
  lockedBalance: number;
}

export interface TestTransaction {
  id: string;
  walletId: string;
  actionType: TransactionActionType;
  status: TransactionStatus;
  amount: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
}

// ============================================================================
// FACTORY: Test Data Generators
// ============================================================================

/** Rastgele Ethereum adresi üretir */
export function randomAddress(): string {
  const hex = Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `0x${hex}`;
}

/** Rastgele txHash üretir */
export function randomTxHash(): string {
  const hex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `0x${hex}`;
}

/** Test kullanıcısı oluşturur (DB'ye yazar) */
export async function createTestUser(overrides?: Partial<{ email: string }>): Promise<TestUser> {
  const prisma = getPrisma();
  const id = uuidv4();
  const email = overrides?.email ?? `test-${id.slice(0, 8)}@tipbox-test.local`;

  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash: '$2b$10$dummyhashfortesting000000000000000000000000000000',
      emailVerified: true,
    },
  });

  return { id, email };
}

/** Test wallet'ı oluşturur (DB'ye yazar) */
export async function createTestWallet(
  userId: string,
  overrides?: Partial<{
    balance: number;
    lockedBalance: number;
    publicAddress: string;
    smartAccountAddress: string;
  }>,
): Promise<TestWallet> {
  const prisma = getPrisma();
  const publicAddress = overrides?.publicAddress ?? randomAddress();
  const smartAccountAddress = overrides?.smartAccountAddress ?? randomAddress();

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      publicAddress,
      smartAccountAddress,
      provider: 'THIRDWEB',
      isConnected: true,
      balance: overrides?.balance ?? 1000,
      lockedBalance: overrides?.lockedBalance ?? 0,
    },
  });

  return {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    smartAccountAddress: wallet.smartAccountAddress!,
    balance: wallet.balance,
    lockedBalance: wallet.lockedBalance,
  };
}

/** Test transaction oluşturur (DB'ye yazar) */
export async function createTestTransaction(
  walletId: string,
  overrides?: Partial<{
    actionType: TransactionActionType;
    status: TransactionStatus;
    amount: number;
    fromAddress: string;
    toAddress: string;
    txHash: string;
    metadata: Record<string, unknown>;
    provider: string;
  }>,
): Promise<TestTransaction> {
  const prisma = getPrisma();

  const tx = await prisma.transaction.create({
    data: {
      walletId,
      actionType: overrides?.actionType ?? TransactionActionType.TIP_SEND,
      status: overrides?.status ?? TransactionStatus.CREATED,
      amount: overrides?.amount ?? 100,
      fromAddress: overrides?.fromAddress ?? randomAddress(),
      toAddress: overrides?.toAddress ?? randomAddress(),
      txHash: overrides?.txHash ?? null,
      metadata: overrides?.metadata ?? {},
      provider: overrides?.provider ?? 'thirdweb',
      errorMessage: null,
      confirmedAt: null,
      failedAt: null,
    },
  });

  return {
    id: tx.id,
    walletId: tx.walletId,
    actionType: tx.actionType as TransactionActionType,
    status: tx.status as TransactionStatus,
    amount: tx.amount,
    fromAddress: tx.fromAddress,
    toAddress: tx.toAddress,
    txHash: tx.txHash,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/** Belirli user ID'lere ait tüm test verisini temizler */
export async function cleanupTestData(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const prisma = getPrisma();

  // Sıralama: FK kısıtlamaları nedeniyle önce bağımlı tablolar
  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const walletIds = wallets.map((w) => w.id);

  if (walletIds.length > 0) {
    await prisma.thirdwebWebhookLog.deleteMany({
      where: {
        transactionId: {
          in: (
            await prisma.transaction.findMany({
              where: { walletId: { in: walletIds } },
              select: { id: true },
            })
          ).map((t) => t.id),
        },
      },
    });
    await prisma.transaction.deleteMany({ where: { walletId: { in: walletIds } } });
    await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
  }

  // Profile varsa sil
  await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ============================================================================
// DB QUERY HELPERS
// ============================================================================

/** Transaction'ı DB'den direkt okur (service bypass) */
export async function getTransactionFromDB(id: string) {
  const prisma = getPrisma();
  return prisma.transaction.findUnique({ where: { id } });
}

/** Wallet'ı DB'den direkt okur */
export async function getWalletFromDB(id: string) {
  const prisma = getPrisma();
  return prisma.wallet.findUnique({ where: { id } });
}

/** Webhook log'u DB'den direkt okur */
export async function getWebhookLogFromDB(queueId: string) {
  const prisma = getPrisma();
  return prisma.thirdwebWebhookLog.findUnique({ where: { queueId } });
}

// ============================================================================
// MOCK: Thirdweb Webhook Payload Builder
// ============================================================================

export function buildWebhookPayload(
  overrides: Partial<{
    queueId: string;
    status: 'sent' | 'mined' | 'errored' | 'cancelled';
    onchainStatus: 'success' | 'reverted' | null;
    chainId: number;
    fromAddress: string;
    toAddress: string;
    transactionHash: string;
    blockNumber: number;
    errorMessage: string;
    functionArgs: string;
  }> = {},
) {
  return {
    queueId: overrides.queueId ?? uuidv4(),
    status: overrides.status ?? 'mined',
    onchainStatus: overrides.onchainStatus ?? 'success',
    queuedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    minedAt: overrides.status === 'mined' ? new Date().toISOString() : null,
    errorMessage: overrides.errorMessage ?? null,
    cancelledAt: null,
    retryCount: 0,
    chainId: overrides.chainId ?? 84532,
    fromAddress: overrides.fromAddress ?? randomAddress(),
    toAddress: overrides.toAddress ?? randomAddress(),
    data: '0x',
    value: '0',
    nonce: 1,
    gasLimit: '100000',
    maxFeePerGas: '1000000000',
    maxPriorityFeePerGas: '1000000',
    gasPrice: '1000000000',
    transactionType: 2,
    transactionHash: overrides.transactionHash ?? randomTxHash(),
    sentAtBlockNumber: 1000,
    blockNumber: overrides.blockNumber ?? 1001,
    signerAddress: null,
    accountAddress: null,
    target: null,
    sender: null,
    initCode: null,
    callData: null,
    callGasLimit: null,
    verificationGasLimit: null,
    preVerificationGas: null,
    paymasterAndData: null,
    userOpHash: null,
    functionName: null,
    functionArgs: overrides.functionArgs ?? null,
    extension: null,
    deployedContractAddress: null,
    deployedContractType: null,
  };
}
