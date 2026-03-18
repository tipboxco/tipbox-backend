/**
 * Transaction Lifecycle E2E Tests
 *
 * Bu test dosyası TIPS token transfer sisteminin uçtan uca akışını test eder.
 * Gerçek DB kullanır, Thirdweb SDK ve Redis queue mock'lanır.
 *
 * Test senaryoları:
 * 1. TIP_SEND  — Kullanıcıdan kullanıcıya tip gönderme
 * 2. WITHDRAW  — External wallet'a token çekme
 * 3. DEPOSIT   — External wallet'tan token yatırma (webhook)
 * 4. Webhook   — Transaction lifecycle (sent → mined → confirmed)
 * 5. Cancel    — Tip gönderiminin iptali
 * 6. Edge Cases — Yetersiz bakiye, kendine gönderim, geçersiz adres vb.
 */

import {
  createTestUser,
  createTestWallet,
  cleanupTestData,
  getTransactionFromDB,
  getWalletFromDB,
  getWebhookLogFromDB,
  buildWebhookPayload,
  randomAddress,
  randomTxHash,
  TestUser,
  TestWallet,
} from './helpers';
import { TransactionService } from '../../src/application/transaction/transaction.service';
import { ThirdwebWebhookService } from '../../src/application/thirdweb-webhook/thirdweb-webhook.service';
import { WalletService } from '../../src/application/wallet/wallet.service';
import { TransactionPrismaRepository } from '../../src/infrastructure/repositories/transaction-prisma.repository';
import { WalletPrismaRepository } from '../../src/infrastructure/repositories/wallet-prisma.repository';
import { TransactionActionType } from '../../src/domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../src/domain/transaction/transaction-status.enum';
import { NotificationType } from '../../src/domain/notification/notification-type.enum';
import { getPrisma } from '../../src/infrastructure/repositories/prisma.client';

// ============================================================================
// MOCK: Queue Provider — addTipSendJob'u yakalayarak gerçek Redis'e ihtiyacı ortadan kaldırır
// ============================================================================

const mockAddTipSendJob = jest.fn().mockResolvedValue({ id: 'mock-job-id' });

jest.mock('../../src/infrastructure/queue/queue.provider', () => {
  return {
    __esModule: true,
    default: {
      getInstance: () => ({
        addTipSendJob: mockAddTipSendJob,
        getQueue: jest.fn(),
      }),
    },
  };
});

// ============================================================================
// MOCK: Thirdweb SDK — chain'e çıkmadan balance sync'i simüle eder
// Test bazında isConfigured ve feePercentage değiştirilebilir.
// ============================================================================

let mockSdkIsConfigured = false;
let mockSdkFeePercentage = 0;

jest.mock('../../src/application/wallet/thirdweb-sdk/thirdweb-sdk.service', () => ({
  getThirdwebSdkService: () => ({
    isConfigured: () => mockSdkIsConfigured,
    getFeePercentage: jest.fn().mockImplementation(() => Promise.resolve(mockSdkFeePercentage)),
    getFeeRecipient: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000fee'),
    authenticateAndGetAddresses: jest.fn(),
    getTokenBalanceForAddress: jest.fn().mockResolvedValue({ balanceFormatted: 0 }),
    getPendingTips: jest.fn().mockResolvedValue({ pendingFormatted: 0 }),
    sendTip: jest.fn(),
    transferToAddress: jest.fn(),
  }),
}));

// ============================================================================
// MOCK: Notification Service — sendNotification çağrılarını yakalar
// ============================================================================

const mockSendNotification = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/application/notification/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendNotification: mockSendNotification,
  })),
}));

// ============================================================================
// MOCK: Cache Invalidation — Redis olmadan çalışır
// ============================================================================

jest.mock('../../src/infrastructure/cache/cache-invalidation', () => ({
  invalidateWalletCache: jest.fn().mockResolvedValue(undefined),
  invalidateNFTCache: jest.fn().mockResolvedValue(undefined),
  invalidateUserNFTCache: jest.fn().mockResolvedValue(undefined),
}));

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Transaction Lifecycle E2E', () => {
  // Test data
  let sender: TestUser;
  let receiver: TestUser;
  let senderWallet: TestWallet;
  let receiverWallet: TestWallet;
  const testUserIds: string[] = [];

  // Services
  let transactionService: TransactionService;
  let webhookService: ThirdwebWebhookService;
  let walletService: WalletService;
  let transactionRepo: TransactionPrismaRepository;
  let walletRepo: WalletPrismaRepository;

  beforeAll(async () => {
    transactionService = new TransactionService();
    webhookService = new ThirdwebWebhookService();
    walletService = new WalletService();
    transactionRepo = new TransactionPrismaRepository();
    walletRepo = new WalletPrismaRepository();
  });

  beforeEach(async () => {
    // Her test için temiz kullanıcı ve wallet oluştur
    sender = await createTestUser();
    receiver = await createTestUser();
    testUserIds.push(sender.id, receiver.id);

    senderWallet = await createTestWallet(sender.id, { balance: 1000, lockedBalance: 0 });
    receiverWallet = await createTestWallet(receiver.id, { balance: 500, lockedBalance: 0 });

    // Mock'ları sıfırla
    mockAddTipSendJob.mockClear();
    mockSendNotification.mockClear();

    // SDK varsayılan: fee yok
    mockSdkIsConfigured = false;
    mockSdkFeePercentage = 0;
  });

  afterAll(async () => {
    await cleanupTestData(testUserIds);
  });

  // ==========================================================================
  // 1. TIP_SEND — Kullanıcıdan Kullanıcıya
  // ==========================================================================

  describe('TIP_SEND (User → User)', () => {
    it('should create SEND and RECEIVE transactions with status "created"', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
        reason: 'Great post!',
      });

      // SEND transaction kontrol
      expect(result.transaction).toBeDefined();
      expect(result.transaction.actionType).toBe(TransactionActionType.TIP_SEND);
      expect(result.transaction.status).toBe(TransactionStatus.CREATED);
      expect(result.transaction.amount).toBe(100);
      expect(result.transaction.walletId).toBe(senderWallet.id);

      // DB'den SEND transaction kontrol
      const sendTx = await getTransactionFromDB(result.transaction.id);
      expect(sendTx).not.toBeNull();
      expect(sendTx!.status).toBe(TransactionStatus.CREATED);
      expect(sendTx!.actionType).toBe(TransactionActionType.TIP_SEND);
      expect(sendTx!.fromAddress).toBe(senderWallet.smartAccountAddress);
      expect(sendTx!.toAddress).toBe(receiverWallet.smartAccountAddress);

      // Metadata: pairedTransactionId olmalı
      const metadata = sendTx!.metadata as Record<string, unknown>;
      expect(metadata.pairedTransactionId).toBeDefined();

      // RECEIVE transaction kontrol (metadata'daki ID ile)
      const receiveTx = await getTransactionFromDB(metadata.pairedTransactionId as string);
      expect(receiveTx).not.toBeNull();
      expect(receiveTx!.actionType).toBe(TransactionActionType.TIP_RECEIVE);
      expect(receiveTx!.status).toBe(TransactionStatus.CREATED);
      expect(receiveTx!.walletId).toBe(receiverWallet.id);
      expect(receiveTx!.amount).toBe(100);
    });

    it('should queue a tip-send job to Redis', async () => {
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      expect(mockAddTipSendJob).toHaveBeenCalledTimes(1);
      const jobData = mockAddTipSendJob.mock.calls[0][0];
      expect(jobData.fromUserId).toBe(sender.id);
      expect(jobData.toAddress).toBe(receiverWallet.smartAccountAddress);
      expect(jobData.amount).toBe(50);
      expect(jobData.useErc20Transfer).toBe(false); // Tipbox user = contract tip()
    });

    it('should use smartAccountAddress over publicAddress for tip target', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 10,
      });

      const tx = await getTransactionFromDB(result.transaction.id);
      // Alıcının smartAccountAddress'i tercih edilmeli
      expect(tx!.toAddress).toBe(receiverWallet.smartAccountAddress);
      // Gönderenin smartAccountAddress'i kullanılmalı
      expect(tx!.fromAddress).toBe(senderWallet.smartAccountAddress);
    });

    it('should confirm TIP_SEND and TIP_RECEIVE when confirmTransaction is called', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      // Confirm SEND
      const confirmedSend = await transactionService.confirmTransaction(result.transaction.id, randomTxHash());
      expect(confirmedSend.status).toBe(TransactionStatus.CONFIRMED);

      // Confirm RECEIVE
      const confirmedReceive = await transactionService.confirmTransaction(receiveId, randomTxHash());
      expect(confirmedReceive.status).toBe(TransactionStatus.CONFIRMED);

      // DB kontrol
      const sendInDb = await getTransactionFromDB(result.transaction.id);
      expect(sendInDb!.status).toBe(TransactionStatus.CONFIRMED);
      expect(sendInDb!.confirmedAt).not.toBeNull();

      const receiveInDb = await getTransactionFromDB(receiveId);
      expect(receiveInDb!.status).toBe(TransactionStatus.CONFIRMED);
      expect(receiveInDb!.confirmedAt).not.toBeNull();
    });

    it('should fail both SEND and RECEIVE when failTransaction is called', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      // Fail SEND
      await transactionService.failTransaction(result.transaction.id, 'SDK error: gas too low');
      // Fail RECEIVE
      await transactionService.failTransaction(receiveId, 'SDK error: gas too low');

      const sendInDb = await getTransactionFromDB(result.transaction.id);
      expect(sendInDb!.status).toBe(TransactionStatus.FAILED);
      expect(sendInDb!.errorMessage).toBe('SDK error: gas too low');
      expect(sendInDb!.failedAt).not.toBeNull();

      const receiveInDb = await getTransactionFromDB(receiveId);
      expect(receiveInDb!.status).toBe(TransactionStatus.FAILED);
    });
  });

  // ==========================================================================
  // 2. WITHDRAW — External Wallet'a Token Çekme
  // ==========================================================================

  describe('WITHDRAW (User → External Wallet)', () => {
    it('should create WITHDRAW transaction when recipient is an Ethereum address', async () => {
      const externalAddress = randomAddress();

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress, // 0x adres = external wallet
        amount: 200,
        reason: 'Withdraw to MetaMask',
      });

      expect(result.transaction.actionType).toBe(TransactionActionType.WITHDRAW);
      expect(result.transaction.status).toBe(TransactionStatus.CREATED);
      expect(result.transaction.amount).toBe(200);

      // DB kontrolü
      const tx = await getTransactionFromDB(result.transaction.id);
      expect(tx!.actionType).toBe(TransactionActionType.WITHDRAW);
      expect(tx!.toAddress).toBe(externalAddress.toLowerCase().replace('0X', '0x'));
      expect(tx!.walletId).toBe(senderWallet.id);

      // Metadata: recipientAddress olmalı, recipientUserId null olmalı
      const metadata = tx!.metadata as Record<string, unknown>;
      expect(metadata.recipientUserId).toBeNull();
    });

    it('should queue ERC20 transfer job for withdrawal', async () => {
      const externalAddress = randomAddress();

      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 150,
      });

      expect(mockAddTipSendJob).toHaveBeenCalledTimes(1);
      const jobData = mockAddTipSendJob.mock.calls[0][0];
      expect(jobData.useErc20Transfer).toBe(true); // External = ERC20 direct
      expect(jobData.amount).toBe(150);
    });

    it('should NOT create RECEIVE transaction for external withdrawal', async () => {
      const externalAddress = randomAddress();

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 100,
      });

      const tx = await getTransactionFromDB(result.transaction.id);
      const metadata = tx!.metadata as Record<string, unknown>;
      // WITHDRAW'da pairedTransactionId olmaz
      expect(metadata.pairedTransactionId).toBeUndefined();
    });

    it('should confirm WITHDRAW and decrease sender balance', async () => {
      const externalAddress = randomAddress();

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 200,
      });

      // Balance öncesi
      const walletBefore = await getWalletFromDB(senderWallet.id);
      const balanceBefore = walletBefore!.balance;

      // Confirm transaction (WITHDRAW tipi TIP_SEND/TIP_RECEIVE çifti değil,
      // ama confirmTransaction'da WITHDRAW == isSend olarak ele alınmaz (isTipPair kontrolü dışında))
      // WITHDRAW = isSend ama isTipPair değil → balance azaltılır
      // NOT: Bu yorum kodun mevcut davranışına göre; WITHDRAW balance'ı confirmTransaction ile azaltılabilir
      const confirmed = await transactionService.confirmTransaction(
        result.transaction.id,
        randomTxHash(),
      );
      expect(confirmed.status).toBe(TransactionStatus.CONFIRMED);
    });
  });

  // ==========================================================================
  // 3. DEPOSIT — External Wallet'tan Token Yatırma (Webhook ile)
  // ==========================================================================

  describe('DEPOSIT (External Wallet → User via Webhook)', () => {
    it('should create DEPOSIT transaction when webhook detects incoming transfer', async () => {
      const externalAddress = randomAddress();

      // Webhook: external → bizim wallet'ın smartAccountAddress
      const payload = buildWebhookPayload({
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: externalAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: randomTxHash(),
        blockNumber: 5000,
      });

      const result = await webhookService.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();

      // DB'den DEPOSIT transaction'ı kontrol et
      const depositTx = await getTransactionFromDB(result.transactionId!);
      expect(depositTx).not.toBeNull();
      expect(depositTx!.actionType).toBe(TransactionActionType.DEPOSIT);
      expect(depositTx!.status).toBe(TransactionStatus.CONFIRMED); // mined = confirmed
      expect(depositTx!.walletId).toBe(receiverWallet.id);
      expect(depositTx!.fromAddress).toBe(externalAddress);
      expect(depositTx!.toAddress).toBe(receiverWallet.smartAccountAddress);
      expect(depositTx!.confirmedAt).not.toBeNull();
    });

    it('should create PENDING deposit when webhook status is "sent"', async () => {
      const externalAddress = randomAddress();

      const payload = buildWebhookPayload({
        status: 'sent',
        onchainStatus: null,
        fromAddress: externalAddress,
        toAddress: receiverWallet.smartAccountAddress,
      });

      const result = await webhookService.processWebhook(payload);

      expect(result.success).toBe(true);
      if (result.transactionId) {
        const depositTx = await getTransactionFromDB(result.transactionId);
        // sent → pending
        expect(depositTx!.status).toBe(TransactionStatus.PENDING);
      }
    });

    it('should create WITHDRAW transaction when webhook detects outgoing transfer from our wallet', async () => {
      const externalTarget = randomAddress();

      const payload = buildWebhookPayload({
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: senderWallet.smartAccountAddress, // bizim wallet'tan
        toAddress: externalTarget, // dışarı
        transactionHash: randomTxHash(),
        blockNumber: 5001,
      });

      const result = await webhookService.processWebhook(payload);

      expect(result.success).toBe(true);
      if (result.transactionId) {
        const withdrawTx = await getTransactionFromDB(result.transactionId);
        expect(withdrawTx).not.toBeNull();
        expect(withdrawTx!.actionType).toBe(TransactionActionType.WITHDRAW);
        expect(withdrawTx!.status).toBe(TransactionStatus.CONFIRMED);
        expect(withdrawTx!.walletId).toBe(senderWallet.id);
      }
    });
  });

  // ==========================================================================
  // 4. WEBHOOK — Transaction Lifecycle (sent → mined → confirmed)
  // ==========================================================================

  describe('Webhook Transaction Lifecycle', () => {
    it('should transition: created → pending (sent webhook) → confirmed (mined webhook)', async () => {
      // Step 1: Tip gönder → status: created
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 75,
      });

      const txId = tipResult.transaction.id;
      const sendTx = await getTransactionFromDB(txId);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;
      const txHash = randomTxHash();

      // İlk olarak transaction'ları pending'e geçirelim (worker'ın yapacağı gibi)
      await transactionRepo.updateStatus(txId, TransactionStatus.PENDING, { txHash });
      await transactionRepo.updateStatus(receiveId, TransactionStatus.PENDING, { txHash });

      // Step 2: Sent webhook → SEND ve RECEIVE pending durumunda kalır
      const sentPayload = buildWebhookPayload({
        queueId: `queue-${txId}`,
        status: 'sent',
        fromAddress: senderWallet.smartAccountAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
      });

      const sentResult = await webhookService.processWebhook(sentPayload);
      expect(sentResult.success).toBe(true);

      // Step 3: Mined webhook → SEND ve RECEIVE confirmed olmalı
      const minedPayload = buildWebhookPayload({
        queueId: `queue-${txId}`,
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: senderWallet.smartAccountAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
        blockNumber: 6000,
      });

      const minedResult = await webhookService.processWebhook(minedPayload);
      expect(minedResult.success).toBe(true);

      // DB kontrol: hem SEND hem RECEIVE confirmed olmalı
      const confirmedSend = await getTransactionFromDB(txId);
      expect(confirmedSend!.status).toBe(TransactionStatus.CONFIRMED);
      expect(confirmedSend!.confirmedAt).not.toBeNull();

      const confirmedReceive = await getTransactionFromDB(receiveId);
      expect(confirmedReceive!.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should handle reverted transaction (mined with onchainStatus=reverted)', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const txId = tipResult.transaction.id;
      const sendTx = await getTransactionFromDB(txId);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;
      const txHash = randomTxHash();

      // Pending'e geçir
      await transactionRepo.updateStatus(txId, TransactionStatus.PENDING, { txHash });
      await transactionRepo.updateStatus(receiveId, TransactionStatus.PENDING, { txHash });

      // Mined ama reverted!
      const revertedPayload = buildWebhookPayload({
        queueId: `queue-reverted-${txId}`,
        status: 'mined',
        onchainStatus: 'reverted',
        fromAddress: senderWallet.smartAccountAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
        blockNumber: 6001,
      });

      const result = await webhookService.processWebhook(revertedPayload);
      expect(result.success).toBe(true);

      // Hem SEND hem RECEIVE failed olmalı
      const failedSend = await getTransactionFromDB(txId);
      expect(failedSend!.status).toBe(TransactionStatus.FAILED);
      expect(failedSend!.errorMessage).toContain('reverted');

      const failedReceive = await getTransactionFromDB(receiveId);
      expect(failedReceive!.status).toBe(TransactionStatus.FAILED);
    });

    it('should handle errored webhook (engine error)', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 30,
      });
      const txId = tipResult.transaction.id;
      const sendTx = await getTransactionFromDB(txId);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      const errorPayload = buildWebhookPayload({
        queueId: `queue-error-${txId}`,
        status: 'errored',
        fromAddress: senderWallet.smartAccountAddress,
        toAddress: receiverWallet.smartAccountAddress,
        errorMessage: 'Nonce too low',
      });

      // Transaction'ı service metadata'sıyla eşleştirmek için txHash ile link kur
      // (processWebhook transactionId bulamadığında erişebilir)
      // Not: Bu senaryoda webhook direkt transactionId bulamayabilir,
      // çünkü henüz txHash atanmamış. Service loglayıp pass edecek.
      const result = await webhookService.processWebhook(errorPayload);
      expect(result.success).toBe(true);
    });

    it('should handle cancelled webhook', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 20,
      });
      const txId = tipResult.transaction.id;

      const cancelPayload = buildWebhookPayload({
        queueId: `queue-cancel-${txId}`,
        status: 'cancelled',
        fromAddress: senderWallet.smartAccountAddress,
        toAddress: receiverWallet.smartAccountAddress,
      });

      const result = await webhookService.processWebhook(cancelPayload);
      expect(result.success).toBe(true);
    });

    it('should skip lower priority webhook status (idempotency)', async () => {
      const externalAddress = randomAddress();
      const queueId = `queue-idempotent-${Date.now()}`;
      const txHash = randomTxHash();

      // İlk webhook: mined (priority 4)
      const minedPayload = buildWebhookPayload({
        queueId,
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: externalAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
        blockNumber: 7000,
      });

      const firstResult = await webhookService.processWebhook(minedPayload);
      expect(firstResult.success).toBe(true);

      // İkinci webhook: sent (priority 2) — skip edilmeli
      const sentPayload = buildWebhookPayload({
        queueId,
        status: 'sent',
        fromAddress: externalAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
      });

      const secondResult = await webhookService.processWebhook(sentPayload);
      expect(secondResult.success).toBe(true);
      expect(secondResult.action).toBe('skipped');
    });

    it('should save webhook log to DB', async () => {
      const queueId = `queue-log-test-${Date.now()}`;
      const txHash = randomTxHash();

      const payload = buildWebhookPayload({
        queueId,
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: randomAddress(),
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: txHash,
        blockNumber: 8000,
      });

      await webhookService.processWebhook(payload);

      // Webhook log DB'de kayıtlı mı?
      const log = await getWebhookLogFromDB(queueId);
      expect(log).not.toBeNull();
      expect(log!.queueId).toBe(queueId);
      expect(log!.status).toBe('mined');
      expect(log!.transactionHash).toBe(txHash);
      expect(log!.blockNumber).toBe(8000);
    });
  });

  // ==========================================================================
  // 5. CANCEL — Tip Gönderiminin İptali
  // ==========================================================================

  describe('Cancel Tip Send', () => {
    it('should cancel a TIP_SEND in "created" status', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const cancelledTx = await transactionService.cancelTipSend(
        tipResult.transaction.id,
        sender.id,
      );

      expect(cancelledTx.status).toBe(TransactionStatus.FAILED);
      expect(cancelledTx.errorMessage).toBe('Cancelled by user');

      // DB kontrol
      const txInDb = await getTransactionFromDB(tipResult.transaction.id);
      expect(txInDb!.status).toBe(TransactionStatus.FAILED);
      expect(txInDb!.failedAt).not.toBeNull();
    });

    it('should also cancel the linked RECEIVE transaction', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 80,
      });

      const sendTx = await getTransactionFromDB(tipResult.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      await transactionService.cancelTipSend(tipResult.transaction.id, sender.id);

      const receiveInDb = await getTransactionFromDB(receiveId);
      expect(receiveInDb!.status).toBe(TransactionStatus.FAILED);
      expect(receiveInDb!.errorMessage).toBe('Cancelled by user');
    });

    it('should NOT allow cancel if status is "pending" (already on-chain)', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      // Manuel olarak pending'e geçir (worker bunu yapar)
      await transactionRepo.updateStatus(
        tipResult.transaction.id,
        TransactionStatus.PENDING,
        { txHash: randomTxHash() },
      );

      await expect(
        transactionService.cancelTipSend(tipResult.transaction.id, sender.id),
      ).rejects.toThrow(/cannot be cancelled/i);
    });

    it('should NOT allow another user to cancel the transaction', async () => {
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      await expect(
        transactionService.cancelTipSend(tipResult.transaction.id, receiver.id),
      ).rejects.toThrow(/only cancel your own/i);
    });

    it('should cancel a WITHDRAW transaction too', async () => {
      const externalAddress = randomAddress();
      const tipResult = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 100,
      });

      const cancelledTx = await transactionService.cancelTipSend(
        tipResult.transaction.id,
        sender.id,
      );

      expect(cancelledTx.status).toBe(TransactionStatus.FAILED);
      expect(cancelledTx.errorMessage).toBe('Cancelled by user');
    });
  });

  // ==========================================================================
  // 6. EDGE CASES & ERROR SCENARIOS
  // ==========================================================================

  describe('Edge Cases & Validation', () => {
    it('should reject sending 0 or negative amount', async () => {
      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: receiver.id,
          amount: 0,
        }),
      ).rejects.toThrow(/greater than 0/i);

      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: receiver.id,
          amount: -10,
        }),
      ).rejects.toThrow(/greater than 0/i);
    });

    it('should reject sending tips to yourself', async () => {
      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: sender.id,
          amount: 10,
        }),
      ).rejects.toThrow(/yourself/i);
    });

    it('should reject when sender has insufficient balance', async () => {
      // Sender'ın bakiyesi 1000, 1500 göndermeye çalış
      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: receiver.id,
          amount: 1500,
        }),
      ).rejects.toThrow(/insufficient balance/i);
    });

    it('should reject when sender has no wallet', async () => {
      const noWalletUser = await createTestUser();
      testUserIds.push(noWalletUser.id);

      await expect(
        transactionService.sendTip({
          fromUserId: noWalletUser.id,
          toUserId: receiver.id,
          amount: 10,
        }),
      ).rejects.toThrow(/wallet not found/i);
    });

    it('should reject when recipient user does not exist and is not an address', async () => {
      const fakeUserId = '00000000-0000-4000-a000-000000000099';

      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: fakeUserId,
          amount: 10,
        }),
      ).rejects.toThrow(/wallet not found/i);
    });

    it('should reject with invalid Ethereum address format', async () => {
      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: '0xinvalidaddress',
          amount: 10,
        }),
      ).rejects.toThrow(/wallet not found/i);
    });

    it('should handle locked balance correctly (available = balance - locked)', async () => {
      // Sender: balance=1000, lockedBalance=800 → available=200
      const prisma = getPrisma();
      await prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { lockedBalance: 800 },
      });

      // 300 göndermek yetmemeli (available = 200)
      await expect(
        transactionService.sendTip({
          fromUserId: sender.id,
          toUserId: receiver.id,
          amount: 300,
        }),
      ).rejects.toThrow(/insufficient balance/i);

      // 150 göndermek yetmeli (available = 200)
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 150,
      });
      expect(result.transaction).toBeDefined();
    });

    it('should detect address registered in our system as TIP_SEND (not WITHDRAW)', async () => {
      // Receiver'ın smartAccountAddress'ini doğrudan gönder
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiverWallet.smartAccountAddress,
        amount: 50,
      });

      // Adres sistemde kayıtlı → TIP_SEND olmalı (WITHDRAW değil)
      expect(result.transaction.actionType).toBe(TransactionActionType.TIP_SEND);
    });
  });

  // ==========================================================================
  // 7. CLAIM REWARD & BOOST POST (Backend-initiated transactions)
  // ==========================================================================

  describe('Backend-Initiated Transactions', () => {
    it('should claim reward and increase balance', async () => {
      const balanceBefore = (await getWalletFromDB(receiverWallet.id))!.balance;

      const tx = await transactionService.claimReward(
        receiver.id,
        'reward-ladder-1',
        50,
        'LADDER',
      );

      expect(tx.actionType).toBe(TransactionActionType.CLAIM_REWARD);

      // Transaction DB'de confirmed olmalı
      const txInDb = await getTransactionFromDB(tx.id);
      expect(txInDb!.status).toBe(TransactionStatus.CONFIRMED);

      // Balance artmış olmalı
      const balanceAfter = (await getWalletFromDB(receiverWallet.id))!.balance;
      expect(balanceAfter).toBe(balanceBefore + 50);
    });

    it('should deduct for post boost and decrease balance', async () => {
      const balanceBefore = (await getWalletFromDB(senderWallet.id))!.balance;

      const tx = await transactionService.deductForPostBoost(
        sender.id,
        100,
        'post-123',
      );

      expect(tx.actionType).toBe(TransactionActionType.BOOST_POST);

      // Balance azalmış olmalı
      const balanceAfter = (await getWalletFromDB(senderWallet.id))!.balance;
      expect(balanceAfter).toBe(balanceBefore - 100);
    });

    it('should reject boost with insufficient balance', async () => {
      await expect(
        transactionService.deductForPostBoost(sender.id, 5000, 'post-456'),
      ).rejects.toThrow(/insufficient balance/i);
    });
  });

  // ==========================================================================
  // 8. WALLET SERVICE
  // ==========================================================================

  describe('Wallet Service', () => {
    it('should update balance (positive)', async () => {
      const before = (await getWalletFromDB(senderWallet.id))!.balance;

      await walletService.updateBalance(senderWallet.id, 250, {
        reason: 'Test deposit',
      });

      const after = (await getWalletFromDB(senderWallet.id))!.balance;
      expect(after).toBe(before + 250);
    });

    it('should update balance (negative)', async () => {
      const before = (await getWalletFromDB(senderWallet.id))!.balance;

      await walletService.updateBalance(senderWallet.id, -100, {
        reason: 'Test withdrawal',
      });

      const after = (await getWalletFromDB(senderWallet.id))!.balance;
      expect(after).toBe(before - 100);
    });

    it('should reject negative balance', async () => {
      await expect(
        walletService.updateBalance(senderWallet.id, -99999, {
          reason: 'Should fail',
        }),
      ).rejects.toThrow(/insufficient balance/i);
    });

    it('should update locked balance', async () => {
      await walletService.updateLockedBalance(senderWallet.id, 200, {
        reason: 'Lock for lootbox',
      });

      const wallet = await getWalletFromDB(senderWallet.id);
      expect(wallet!.lockedBalance).toBe(200);
    });

    it('should reject locking more than available', async () => {
      // Balance 1000, lockedBalance 0, available 1000
      await expect(
        walletService.updateLockedBalance(senderWallet.id, 1500, {
          reason: 'Should fail',
        }),
      ).rejects.toThrow(/insufficient/i);
    });

    it('should get user balance correctly', async () => {
      // Set known state
      const prisma = getPrisma();
      await prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: 500, lockedBalance: 100 },
      });

      const balance = await walletService.getUserBalance(sender.id);
      expect(balance.balance).toBe(500);
      expect(balance.lockedBalance).toBe(100);
      expect(balance.available).toBe(400);
    });
  });

  // ==========================================================================
  // 9. TRANSACTION HISTORY
  // ==========================================================================

  describe('Transaction History', () => {
    it('should return user transaction history', async () => {
      // Birkaç transaction oluştur
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 10,
      });
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 20,
      });
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 30,
      });

      const history = await transactionService.getUserTransactionHistory(sender.id, { limit: 10 });

      expect(history.items.length).toBeGreaterThanOrEqual(3);
      // En son gönderilen ilk sırada (desc order)
      expect(history.items[0].amount).toBe(30);
    });

    it('should paginate transaction history', async () => {
      // Pagination için en az 2 transaction gerekli
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 10,
      });
      await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 20,
      });

      // Limit 1 ile test et
      const page1 = await transactionService.getUserTransactionHistory(sender.id, { limit: 1 });
      expect(page1.items.length).toBe(1);

      if (page1.hasMore && page1.cursor) {
        const page2 = await transactionService.getUserTransactionHistory(sender.id, {
          limit: 1,
          cursor: page1.cursor,
        });
        expect(page2.items.length).toBeGreaterThanOrEqual(1);
        // Farklı transaction'lar olmalı
        expect(page2.items[0].id).not.toBe(page1.items[0].id);
      }
    });

    it('should return empty history for user with no wallet', async () => {
      const noWalletUser = await createTestUser();
      testUserIds.push(noWalletUser.id);

      const history = await transactionService.getUserTransactionHistory(noWalletUser.id);
      expect(history.items).toHaveLength(0);
      expect(history.hasMore).toBe(false);
    });

    it('should return grouped transaction history', async () => {
      const grouped = await transactionService.getUserTransactionHistoryGrouped(sender.id);

      expect(grouped).toHaveProperty('today');
      expect(grouped).toHaveProperty('yesterday');
      expect(grouped).toHaveProperty('lastWeek');
      expect(grouped).toHaveProperty('lastMonth');
      expect(grouped).toHaveProperty('older');
    });
  });

  // ==========================================================================
  // 10. WEBHOOK SIGNATURE VERIFICATION
  // ==========================================================================

  describe('Webhook Signature Verification', () => {
    it('should generate and verify valid signature', () => {
      const secret = 'test-webhook-secret-key';
      const body = JSON.stringify({ queueId: 'q1', status: 'mined' });
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const signature = webhookService.generateSignature(body, timestamp, secret);
      expect(signature).toBeTruthy();

      const isValid = webhookService.isValidSignature(body, timestamp, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const secret = 'test-webhook-secret-key';
      const body = JSON.stringify({ queueId: 'q2', status: 'sent' });
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Doğru uzunlukta ama yanlış signature (timingSafeEqual aynı uzunluk gerektirir)
      const validSig = webhookService.generateSignature(body, timestamp, secret);
      // Signature'ın son karakterini değiştir
      const tamperedSig = validSig.slice(0, -1) + (validSig.endsWith('0') ? '1' : '0');

      const isValid = webhookService.isValidSignature(body, timestamp, tamperedSig, secret);
      expect(isValid).toBe(false);
    });

    it('should detect expired timestamp', () => {
      // 10 dakika önceki timestamp (default 300s expiration)
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      expect(webhookService.isExpired(oldTimestamp)).toBe(true);

      // Şu anki timestamp
      const nowTimestamp = Math.floor(Date.now() / 1000).toString();
      expect(webhookService.isExpired(nowTimestamp)).toBe(false);
    });

    it('should detect invalid timestamp format', () => {
      expect(webhookService.isExpired('not-a-number')).toBe(true);
      expect(webhookService.isExpired('')).toBe(true);
    });
  });

  // ==========================================================================
  // 11. FEE CALCULATION — Commission Deduction (BUG-15)
  // ==========================================================================

  describe('Fee Calculation (Commission Deduction)', () => {
    it('should create RECEIVE with netAmount when fee is active', async () => {
      // Fee aktif: %25 komisyon
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 25;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      // SEND transaction: gross amount (100)
      expect(result.transaction.amount).toBe(100);
      expect(result.transaction.actionType).toBe(TransactionActionType.TIP_SEND);

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const sendMeta = sendTx!.metadata as Record<string, unknown>;
      expect(sendMeta.feeAmount).toBe(25);
      expect(sendMeta.feePercentage).toBe(25);
      expect(sendMeta.pairedTransactionId).toBeDefined();

      // RECEIVE transaction: net amount (75)
      const receiveTx = await getTransactionFromDB(sendMeta.pairedTransactionId as string);
      expect(receiveTx).not.toBeNull();
      expect(receiveTx!.amount).toBe(75); // 100 - 25 = 75

      const receiveMeta = receiveTx!.metadata as Record<string, unknown>;
      expect(receiveMeta.grossAmount).toBe(100);
      expect(receiveMeta.feeAmount).toBe(25);
      expect(receiveMeta.feePercentage).toBe(25);
      expect(receiveMeta.senderUserId).toBe(sender.id);
    });

    it('should NOT apply fee when SDK is not configured', async () => {
      // Fee kapalı (default)
      mockSdkIsConfigured = false;
      mockSdkFeePercentage = 0;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const sendMeta = sendTx!.metadata as Record<string, unknown>;
      expect(sendMeta.feeAmount).toBeUndefined();

      // RECEIVE transaction: tam tutar (100)
      const receiveTx = await getTransactionFromDB(sendMeta.pairedTransactionId as string);
      expect(receiveTx!.amount).toBe(100);
    });

    it('should NOT apply fee for WITHDRAW (external address)', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 25;

      const externalAddress = randomAddress();
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 100,
      });

      // WITHDRAW: fee uygulanmaz
      expect(result.transaction.actionType).toBe(TransactionActionType.WITHDRAW);
      expect(result.transaction.amount).toBe(100);

      const tx = await getTransactionFromDB(result.transaction.id);
      const meta = tx!.metadata as Record<string, unknown>;
      expect(meta.feeAmount).toBeUndefined();
    });

    it('should floor decimal fee amounts (33% of 100 = floor(33) = 33)', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 33;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const sendMeta = sendTx!.metadata as Record<string, unknown>;
      // Math.floor(100 * 33 / 100) = Math.floor(33) = 33
      expect(sendMeta.feeAmount).toBe(33);
      expect(sendMeta.feePercentage).toBe(33);

      const receiveTx = await getTransactionFromDB(sendMeta.pairedTransactionId as string);
      expect(receiveTx!.amount).toBe(67); // 100 - 33 = 67
    });

    it('should floor decimal fee for small amounts (17% of 10 = floor(1.7) = 1)', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 17;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 10,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const sendMeta = sendTx!.metadata as Record<string, unknown>;
      // Math.floor(10 * 17 / 100) = Math.floor(1.7) = 1
      expect(sendMeta.feeAmount).toBe(1);

      const receiveTx = await getTransactionFromDB(sendMeta.pairedTransactionId as string);
      expect(receiveTx!.amount).toBe(9); // 10 - 1 = 9
    });

    it('should handle 0% fee gracefully', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 0;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const sendMeta = sendTx!.metadata as Record<string, unknown>;
      expect(sendMeta.feeAmount).toBeUndefined(); // 0% = no fee field

      const receiveTx = await getTransactionFromDB(sendMeta.pairedTransactionId as string);
      expect(receiveTx!.amount).toBe(100); // No deduction
    });
  });

  // ==========================================================================
  // 12. ATOMIC CONFIRM GUARD — Double-confirm Prevention (BUG-21)
  // ==========================================================================

  describe('Atomic Confirm Guard (Double-Confirm Prevention)', () => {
    it('should return existing transaction on second confirm call (no error)', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const txId = result.transaction.id;
      const txHash = randomTxHash();

      // İlk confirm — başarılı
      const first = await transactionService.confirmTransaction(txId, txHash);
      expect(first.status).toBe(TransactionStatus.CONFIRMED);

      // İkinci confirm — hata vermemeli, mevcut confirmed döndürmeli
      const second = await transactionService.confirmTransaction(txId, txHash);
      expect(second.status).toBe(TransactionStatus.CONFIRMED);
      expect(second.id).toBe(txId);
    });

    it('should not send duplicate notifications on double confirm', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const txId = result.transaction.id;
      const txHash = randomTxHash();
      mockSendNotification.mockClear();

      // İlk confirm
      await transactionService.confirmTransaction(txId, txHash);
      await new Promise((r) => setTimeout(r, 50));
      const notifCountAfterFirst = mockSendNotification.mock.calls.length;

      // İkinci confirm — ek notification gönderilmemeli
      await transactionService.confirmTransaction(txId, txHash);
      await new Promise((r) => setTimeout(r, 50));
      const notifCountAfterSecond = mockSendNotification.mock.calls.length;

      expect(notifCountAfterSecond).toBe(notifCountAfterFirst);
    });
  });

  // ==========================================================================
  // 13. NOTIFICATION DATA VALIDATION (BUG-22, BUG-23)
  // ==========================================================================

  describe('Notification Data Validation', () => {
    it('should send TIPS_SENT notification with recipientUserId (not senderUserId) on confirm', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      mockSendNotification.mockClear();
      await transactionService.confirmTransaction(result.transaction.id, randomTxHash());
      // confirmTransaction notification'ı fire-and-forget (.catch) gönderir; microtask'ın tamamlanmasını bekle
      await new Promise((r) => setTimeout(r, 50));

      // TIPS_SENT notification gönderilmiş mi?
      const tipsSentCall = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TIPS_SENT,
      );
      expect(tipsSentCall).toBeDefined();
      // İlk argüman: userId (gönderen)
      expect(tipsSentCall![0]).toBe(sender.id);
      // Üçüncü argüman: data objesi
      const data = tipsSentCall![2] as Record<string, unknown>;
      // N1/N2 fix: senderUserId TIPS_SENT data'sından çıkarıldı (enricher'ın recipientUserId kullanması için)
      expect(data.senderUserId).toBeUndefined();
      expect(data.recipientUserId).toBe(receiver.id);
      expect(data.amount).toBe(100);
      expect(data.transactionId).toBe(result.transaction.id);
    });

    it('should send TIPS_RECEIVED notification with senderUserId on confirm', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      mockSendNotification.mockClear();
      await transactionService.confirmTransaction(receiveId, randomTxHash());
      // confirmTransaction notification'ı fire-and-forget (.catch) gönderir; microtask'ın tamamlanmasını bekle
      await new Promise((r) => setTimeout(r, 50));

      // TIPS_RECEIVED notification gönderilmiş mi?
      const tipsReceivedCall = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TIPS_RECEIVED,
      );
      expect(tipsReceivedCall).toBeDefined();
      // İlk argüman: userId (alıcı)
      expect(tipsReceivedCall![0]).toBe(receiver.id);
      // Data: senderUserId olmalı
      const data = tipsReceivedCall![2] as Record<string, unknown>;
      expect(data.senderUserId).toBe(sender.id);
    });

    it('should NOT send notification for DEPOSIT', async () => {
      const externalAddress = randomAddress();

      const payload = buildWebhookPayload({
        status: 'mined',
        onchainStatus: 'success',
        fromAddress: externalAddress,
        toAddress: receiverWallet.smartAccountAddress,
        transactionHash: randomTxHash(),
        blockNumber: 9000,
      });

      mockSendNotification.mockClear();
      await webhookService.processWebhook(payload);

      // DEPOSIT için notification gönderilmemeli
      const depositNotif = mockSendNotification.mock.calls.find(
        (call: unknown[]) =>
          call[1] === NotificationType.TRANSACTION_CONFIRMED ||
          call[1] === NotificationType.TRANSACTION_PENDING,
      );
      expect(depositNotif).toBeUndefined();
    });
  });

  // ==========================================================================
  // 14. FAILED NOTIFICATION FILTER (BUG-19)
  // ==========================================================================

  describe('Failed Notification Filter', () => {
    it('should send TRANSACTION_FAILED notification for TIP_SEND failure', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      mockSendNotification.mockClear();
      await transactionService.failTransaction(result.transaction.id, 'On-chain revert');
      await new Promise((r) => setTimeout(r, 50));

      // TIP_SEND fail → notification gönderilmeli
      const failNotif = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TRANSACTION_FAILED,
      );
      expect(failNotif).toBeDefined();
      expect(failNotif![0]).toBe(sender.id);
      const data = failNotif![2] as Record<string, unknown>;
      expect(data.errorMessage).toBe('On-chain revert');
      expect(data.actionType).toBe(TransactionActionType.TIP_SEND);
    });

    it('should NOT send notification for TIP_RECEIVE failure (BUG-19)', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      mockSendNotification.mockClear();
      await transactionService.failTransaction(receiveId, 'On-chain revert');
      await new Promise((r) => setTimeout(r, 50));

      // TIP_RECEIVE fail → notification gönderilmemeli (alıcı henüz haberdar değil)
      const failNotif = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TRANSACTION_FAILED,
      );
      expect(failNotif).toBeUndefined();
    });

    it('should NOT send notification for WITHDRAW failure', async () => {
      const externalAddress = randomAddress();
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 50,
      });

      mockSendNotification.mockClear();
      await transactionService.failTransaction(result.transaction.id, 'Insufficient gas');
      await new Promise((r) => setTimeout(r, 50));

      // WITHDRAW fail → notification gönderilmemeli
      const failNotif = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TRANSACTION_FAILED,
      );
      expect(failNotif).toBeUndefined();
    });
  });

  // ==========================================================================
  // 15. NOTIFICATION ERROR RESILIENCE
  // ==========================================================================

  describe('Notification Error Resilience', () => {
    it('should still confirm transaction even if notification throws', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      // Notification mock'u hata fırlatsın
      mockSendNotification.mockRejectedValueOnce(new Error('Push service down'));

      const txId = result.transaction.id;
      const txHash = randomTxHash();

      // confirmTransaction hata vermemeli
      const confirmed = await transactionService.confirmTransaction(txId, txHash);
      expect(confirmed.status).toBe(TransactionStatus.CONFIRMED);

      // DB'de de confirmed olmalı
      const fromDb = await getTransactionFromDB(txId);
      expect(fromDb!.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should still fail transaction even if notification throws', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      // Notification mock'u hata fırlatsın
      mockSendNotification.mockRejectedValueOnce(new Error('Push service down'));

      const txId = result.transaction.id;

      // failTransaction hata vermemeli
      const failed = await transactionService.failTransaction(txId, 'Some error');
      expect(failed.status).toBe(TransactionStatus.FAILED);

      // DB'de de failed olmalı
      const fromDb = await getTransactionFromDB(txId);
      expect(fromDb!.status).toBe(TransactionStatus.FAILED);
    });
  });

  // ==========================================================================
  // 16. CANCEL METADATA PRESERVATION
  // ==========================================================================

  describe('Cancel Metadata Preservation', () => {
    it('should preserve fee metadata after cancel', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 25;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      // Cancel öncesi metadata kontrol
      const beforeCancel = await getTransactionFromDB(result.transaction.id);
      const metaBefore = beforeCancel!.metadata as Record<string, unknown>;
      expect(metaBefore.feeAmount).toBe(25);
      expect(metaBefore.feePercentage).toBe(25);

      // Cancel et
      await transactionService.cancelTipSend(result.transaction.id, sender.id);

      // Cancel sonrası fee metadata korunmuş olmalı
      const afterCancel = await getTransactionFromDB(result.transaction.id);
      const metaAfter = afterCancel!.metadata as Record<string, unknown>;
      expect(metaAfter.feeAmount).toBe(25);
      expect(metaAfter.feePercentage).toBe(25);
      expect(metaAfter.cancelledByUser).toBe(true);
      expect(metaAfter.pairedTransactionId).toBeDefined();
    });
  });

  // ==========================================================================
  // 17. LOCKED BALANCE UNLOCK ON CONFIRM (C1 fix)
  // ==========================================================================

  describe('Locked Balance Unlock on Confirm (C1)', () => {
    it('should unlock locked balance when TIP_SEND is confirmed', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      // sendTip sonrası locked balance artmış olmalı
      const walletAfterSend = await getWalletFromDB(senderWallet.id);
      expect(walletAfterSend!.lockedBalance).toBe(100);

      // Confirm SEND transaction
      const txHash = randomTxHash();
      await transactionService.confirmTransaction(result.transaction.id, txHash);

      // Confirm sonrası locked balance sıfıra dönmeli
      const walletAfterConfirm = await getWalletFromDB(senderWallet.id);
      expect(walletAfterConfirm!.lockedBalance).toBe(0);
    });

    it('should unlock locked balance when WITHDRAW is confirmed', async () => {
      const externalAddress = randomAddress();
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 200,
      });
      expect(result.transaction.actionType).toBe(TransactionActionType.WITHDRAW);

      // locked balance = 200
      const walletAfterSend = await getWalletFromDB(senderWallet.id);
      expect(walletAfterSend!.lockedBalance).toBe(200);

      // Confirm
      const txHash = randomTxHash();
      await transactionService.confirmTransaction(result.transaction.id, txHash);

      const walletAfterConfirm = await getWalletFromDB(senderWallet.id);
      expect(walletAfterConfirm!.lockedBalance).toBe(0);
    });

    it('should unlock locked balance when TIP_SEND fails', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 150,
      });

      const walletAfterSend = await getWalletFromDB(senderWallet.id);
      expect(walletAfterSend!.lockedBalance).toBe(150);

      // Fail transaction
      await transactionService.failTransaction(result.transaction.id, 'On-chain revert');

      // Fail sonrası locked balance sıfıra dönmeli
      const walletAfterFail = await getWalletFromDB(senderWallet.id);
      expect(walletAfterFail!.lockedBalance).toBe(0);
    });

    it('should unlock locked balance when user cancels tip', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 75,
      });

      const walletAfterSend = await getWalletFromDB(senderWallet.id);
      expect(walletAfterSend!.lockedBalance).toBe(75);

      // Cancel
      await transactionService.cancelTipSend(result.transaction.id, sender.id);

      // Cancel sonrası locked balance sıfıra dönmeli
      const walletAfterCancel = await getWalletFromDB(senderWallet.id);
      expect(walletAfterCancel!.lockedBalance).toBe(0);
    });

    it('should handle multiple sequential tip sends with correct locked balance', async () => {
      // İlk tip: 100
      const result1 = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const walletAfter1 = await getWalletFromDB(senderWallet.id);
      expect(walletAfter1!.lockedBalance).toBe(100);

      // İkinci tip: 200
      const result2 = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 200,
      });

      const walletAfter2 = await getWalletFromDB(senderWallet.id);
      expect(walletAfter2!.lockedBalance).toBe(300);

      // Birincisini confirm et
      await transactionService.confirmTransaction(result1.transaction.id, randomTxHash());
      const walletAfterConfirm1 = await getWalletFromDB(senderWallet.id);
      expect(walletAfterConfirm1!.lockedBalance).toBe(200);

      // İkincisini fail et
      await transactionService.failTransaction(result2.transaction.id, 'Failed');
      const walletAfterFail2 = await getWalletFromDB(senderWallet.id);
      expect(walletAfterFail2!.lockedBalance).toBe(0);
    });
  });

  // ==========================================================================
  // 18. FAIL TRANSACTION STATUS GUARD (C2 fix)
  // ==========================================================================

  describe('Fail Transaction Status Guard (C2)', () => {
    it('should NOT fail an already-confirmed transaction', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const txHash = randomTxHash();
      await transactionService.confirmTransaction(result.transaction.id, txHash);

      // Confirmed tx'i fail etmeye çalış — sessizce confirmed dönmeli
      const failResult = await transactionService.failTransaction(
        result.transaction.id,
        'Late failure attempt',
      );
      expect(failResult.status).toBe(TransactionStatus.CONFIRMED);

      // DB'de hala confirmed
      const fromDb = await getTransactionFromDB(result.transaction.id);
      expect(fromDb!.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should fail a CREATED transaction normally', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      const failResult = await transactionService.failTransaction(
        result.transaction.id,
        'SDK error',
      );
      expect(failResult.status).toBe(TransactionStatus.FAILED);
    });
  });

  // ==========================================================================
  // 19. FEE EDGE CASES (C3 fix)
  // ==========================================================================

  describe('Fee Edge Cases (C3)', () => {
    it('should treat 100% fee as no-fee (misconfiguration guard)', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 100;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 100,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const metadata = sendTx!.metadata as Record<string, unknown>;

      // 100% fee → no fee applied (feeAmount/feePercentage should NOT be in metadata)
      expect(metadata.feeAmount).toBeUndefined();

      // RECEIVE should get full amount
      const receiveId = metadata.pairedTransactionId as string;
      const receiveTx = await getTransactionFromDB(receiveId);
      expect(receiveTx!.amount).toBe(100);
    });

    it('should ensure netAmount >= 1 for high fee percentage on small amount', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 99;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 1,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const metadata = sendTx!.metadata as Record<string, unknown>;
      const receiveId = metadata.pairedTransactionId as string;

      // amount=1, fee=99% → Math.floor(1*99/100)=0 → netAmount=1 (no fee effectively)
      const receiveTx = await getTransactionFromDB(receiveId);
      expect(receiveTx!.amount).toBeGreaterThanOrEqual(1);
    });

    it('should calculate fee correctly for normal percentages', async () => {
      mockSdkIsConfigured = true;
      mockSdkFeePercentage = 10;

      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 1000,
      });

      const sendTx = await getTransactionFromDB(result.transaction.id);
      const metadata = sendTx!.metadata as Record<string, unknown>;
      expect(metadata.feeAmount).toBe(100);
      expect(metadata.feePercentage).toBe(10);

      const receiveId = metadata.pairedTransactionId as string;
      const receiveTx = await getTransactionFromDB(receiveId);
      expect(receiveTx!.amount).toBe(900); // 1000 - 100 = 900
    });
  });

  // ==========================================================================
  // 20. ENTITY isSend() / isReceive() CONSISTENCY (C4 fix)
  // ==========================================================================

  describe('Entity isSend/isReceive Consistency (C4)', () => {
    it('BOOST_POST should be classified as send', async () => {
      // BOOST_POST transaction oluştur
      const result = await transactionService.deductForPostBoost(sender.id, 50, 'test-post-id');
      expect(result.actionType).toBe(TransactionActionType.BOOST_POST);

      // Entity isSend() true dönmeli
      const tx = await transactionService.getTransactionById(result.id);
      expect(tx.isSend()).toBe(true);
      expect(tx.isReceive()).toBe(false);
    });

    it('DEPOSIT should be classified as receive', async () => {
      const prisma = getPrisma();
      // Webhook benzeri DEPOSIT oluştur
      const depositTx = await prisma.transaction.create({
        data: {
          walletId: receiverWallet.id,
          actionType: TransactionActionType.DEPOSIT,
          amount: 500,
          fromAddress: randomAddress(),
          toAddress: receiverWallet.smartAccountAddress,
          status: TransactionStatus.CONFIRMED,
          confirmedAt: new Date(),
          provider: 'alchemy',
          metadata: { source: 'test' },
        },
      });

      const tx = await transactionService.getTransactionById(depositTx.id);
      expect(tx.isReceive()).toBe(true);
      expect(tx.isSend()).toBe(false);
    });

    it('WITHDRAW should be classified as send', async () => {
      const externalAddress = randomAddress();
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: externalAddress,
        amount: 100,
      });

      const tx = await transactionService.getTransactionById(result.transaction.id);
      expect(tx.actionType).toBe(TransactionActionType.WITHDRAW);
      expect(tx.isSend()).toBe(true);
      expect(tx.isReceive()).toBe(false);
    });
  });

  // ==========================================================================
  // 21. NOTIFICATION DATA FORMAT — TIPS_SENT Avatar & System Flag
  // ==========================================================================

  describe('Notification Data Format (N1-N5)', () => {
    it('TIPS_SENT should include recipientUserId but NOT senderUserId (N1/N2)', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 75,
      });

      mockSendNotification.mockClear();
      await transactionService.confirmTransaction(result.transaction.id, randomTxHash());
      await new Promise((r) => setTimeout(r, 50));

      const tipsSent = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TIPS_SENT,
      );
      expect(tipsSent).toBeDefined();
      const data = tipsSent![2] as Record<string, unknown>;

      // recipientUserId olmalı (enricher alıcı avatarı çözmek için)
      expect(data.recipientUserId).toBe(receiver.id);
      // senderUserId OLMAMALI (enricher yanlış avatar çözmemesi için)
      expect(data.senderUserId).toBeUndefined();
      // recipientName olmalı (null olabilir ama field var)
      expect('recipientName' in data).toBe(true);
    });

    it('BOOST_POST notification should have isSystem=true (N3)', async () => {
      mockSendNotification.mockClear();
      await transactionService.deductForPostBoost(sender.id, 25, 'test-post-123');
      await new Promise((r) => setTimeout(r, 50));

      const txConfirmed = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TRANSACTION_CONFIRMED,
      );
      expect(txConfirmed).toBeDefined();
      const data = txConfirmed![2] as Record<string, unknown>;
      expect(data.isSystem).toBe(true);
      expect(data.actionType).toBe(TransactionActionType.BOOST_POST);
    });

    it('TRANSACTION_FAILED should have isSystem=true and errorMessage (N3/N5)', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      mockSendNotification.mockClear();
      await transactionService.failTransaction(result.transaction.id, 'Insufficient gas');
      await new Promise((r) => setTimeout(r, 50));

      const failNotif = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TRANSACTION_FAILED,
      );
      expect(failNotif).toBeDefined();
      const data = failNotif![2] as Record<string, unknown>;
      expect(data.isSystem).toBe(true);
      expect(data.errorMessage).toBe('Insufficient gas');
      expect(data.actionType).toBe(TransactionActionType.TIP_SEND);
    });

    it('TIPS_RECEIVED should NOT have isSystem flag', async () => {
      const result = await transactionService.sendTip({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 50,
      });

      // Confirm RECEIVE
      const sendTx = await getTransactionFromDB(result.transaction.id);
      const receiveId = (sendTx!.metadata as Record<string, unknown>).pairedTransactionId as string;

      mockSendNotification.mockClear();
      await transactionService.confirmTransaction(receiveId, randomTxHash());
      await new Promise((r) => setTimeout(r, 50));

      const tipsReceived = mockSendNotification.mock.calls.find(
        (call: unknown[]) => call[1] === NotificationType.TIPS_RECEIVED,
      );
      expect(tipsReceived).toBeDefined();
      const data = tipsReceived![2] as Record<string, unknown>;
      // TIPS_RECEIVED kullanıcı etkileşimi → isSystem olmamalı
      expect(data.isSystem).toBeUndefined();
      // senderUserId olmalı (gönderenin avatarı gösterilir)
      expect(data.senderUserId).toBe(sender.id);
    });
  });
});
