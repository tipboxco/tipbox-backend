import { PrismaClient, TransactionActionType, TransactionStatus } from '@prisma/client';
import logger from '../../src/infrastructure/logger/logger';

const prisma = new PrismaClient();

/**
 * Transaction Seed Helper
 * Çeşitli transaction senaryoları oluşturur
 */

interface TransactionSeedResult {
  totalWallets: number;
  totalTransactions: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * Kullanıcılar için wallet'lar oluşturur
 */
async function seedWallets(userIds: string[]): Promise<Map<string, string>> {
  logger.info('Creating wallets for users...');
  
  const walletMap = new Map<string, string>(); // userId -> walletId
  
  for (const userId of userIds) {
    try {
      // Wallet zaten var mı kontrol et
      const existing = await prisma.wallet.findFirst({
        where: { userId, isConnected: true }
      });

      if (existing) {
        walletMap.set(userId, existing.id);
        continue;
      }

      // Yeni wallet oluştur
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          publicAddress: `0xTIPBOX_${userId}_${Date.now()}`,
          provider: 'CUSTOM',
          isConnected: true
        }
      });

      walletMap.set(userId, wallet.id);
      logger.info(`Wallet created for user ${userId}: ${wallet.id}`);
    } catch (error) {
      logger.error(`Error creating wallet for user ${userId}:`, error);
    }
  }

  return walletMap;
}

/**
 * Priority kullanıcı ID'leri (seed.ts'deki SEED_USERS ile uyumlu)
 */
const PRIORITY_USER_IDS = [
  '480f5de9-b691-4d70-a6a8-2789226f4e07', // omer@tipbox.co
  '11111111-1111-4111-a111-111111111111', // tuna@tipbox.co
  '22222222-2222-4222-a222-222222222222', // mehmet@tipbox.co
  '33333333-3333-4333-a333-333333333333', // ibrahim@tipbox.co
  '44444444-4444-4444-a444-444444444444', // burakcan@tipbox.co
  '55555555-5555-4555-a555-555555555555', // mihrac@tipbox.co
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // irem@tipbox.co
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // furkan@tipbox.co
  'cccccccc-cccc-4ccc-cccc-cccccccccccc', // aycan@tipbox.co
  '99999999-9999-4999-9999-999999999999', // ozan@tipbox.co
];

/**
 * Ana transaction seed fonksiyonu
 */
export async function seedTransactions(): Promise<TransactionSeedResult> {
  logger.info('🎯 Starting transaction seeding...');

  const result: TransactionSeedResult = {
    totalWallets: 0,
    totalTransactions: 0,
    byType: {},
    byStatus: {}
  };

  // 1. Kullanıcıları al
  const users = await prisma.user.findMany({
    take: 20,
    include: {
      profile: true
    }
  });

  if (users.length < 2) {
    logger.warn('Not enough users to seed transactions');
    return result;
  }

  logger.info(`Found ${users.length} users for transaction seeding`);

  // 2. Wallet'ları oluştur
  const userIds = users.map(u => u.id);
  const walletMap = await seedWallets(userIds);
  result.totalWallets = walletMap.size;

  logger.info(`Created ${result.totalWallets} wallets`);

  // 3. Transaction senaryolarını oluştur
  const scenarios = [
    { name: 'Initial Airdrops', fn: () => seedAirdrops(users, walletMap) },
    { name: 'TIP Transfers', fn: () => seedTipTransfers(users, walletMap) },
    { name: 'Reward Claims', fn: () => seedRewardClaims(users, walletMap) },
    { name: 'Badge Claims', fn: () => seedBadgeClaims(users, walletMap) },
    { name: 'NFT Transactions', fn: () => seedNFTTransactions(users, walletMap) },
    { name: 'Pending Transactions', fn: () => seedPendingTransactions(users, walletMap) },
    { name: 'Failed Transactions', fn: () => seedFailedTransactions(users, walletMap) }
  ];

  for (const scenario of scenarios) {
    try {
      logger.info(`Creating ${scenario.name}...`);
      const count = await scenario.fn();
      result.totalTransactions += count;
      logger.info(`✅ ${scenario.name}: ${count} transactions created`);
    } catch (error) {
      logger.error(`Error in ${scenario.name}:`, error);
    }
  }

  // 4. İstatistikleri hesapla
  const allTransactions = await prisma.transaction.findMany();
  
  for (const tx of allTransactions) {
    result.byType[tx.actionType] = (result.byType[tx.actionType] || 0) + 1;
    result.byStatus[tx.status] = (result.byStatus[tx.status] || 0) + 1;
  }

  logger.info('🎉 Transaction seeding completed!');
  logger.info(`Total: ${result.totalTransactions} transactions`);
  logger.info('By Type:', result.byType);
  logger.info('By Status:', result.byStatus);

  return result;
}

/**
 * Airdrop transaction'ları (başlangıç bakiyesi)
 */
async function seedAirdrops(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  for (const user of users) {
    const walletId = walletMap.get(user.id);
    if (!walletId) continue;

    // Priority kullanıcılara 1000-10000 TIPS, diğerlerine 1000-5000 TIPS airdrop
    const isPriority = PRIORITY_USER_IDS.includes(user.id);
    const amount = isPriority 
      ? Math.floor(Math.random() * 9000) + 1000  // 1000-10000 TIPS
      : Math.floor(Math.random() * 4000) + 1000; // 1000-5000 TIPS
    
    logger.info(`Airdrop for user ${user.profile?.userName || user.email}: ${amount} TIPS ${isPriority ? '(PRIORITY)' : ''}`);
    
    await prisma.transaction.create({
      data: {
        walletId,
        actionType: TransactionActionType.AIRDROP,
        status: TransactionStatus.confirmed,
        amount,
        fromAddress: null,
        toAddress: `0xTIPBOX_${user.id}`,
        metadata: {
          reason: 'Welcome Bonus',
          campaign: 'NEW_USER_2026'
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: daysAgo(Math.floor(Math.random() * 30))
      }
    });

    count++;
  }

  return count;
}

/**
 * TIPS transfer transaction'ları
 */
async function seedTipTransfers(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;
  const scenarios = [
    { amount: 50, reason: 'Great advice, thanks!' },
    { amount: 100, reason: 'Birthday gift 🎂' },
    { amount: 25, reason: 'Coffee money ☕' },
    { amount: 200, reason: 'Helping with the project' },
    { amount: 75, reason: 'Thanks for your help!' },
    { amount: 150, reason: 'Amazing recommendation!' },
    { amount: 30, reason: 'Quick tip' },
    { amount: 500, reason: 'Outstanding support!' },
    { amount: 80, reason: 'Love your content!' },
    { amount: 120, reason: 'Keep up the good work!' },
    { amount: 250, reason: 'Excellent review!' },
    { amount: 60, reason: 'Appreciate it!' },
  ];

  // Priority kullanıcılar arası daha fazla transaction (15 transfer)
  for (let i = 0; i < 15; i++) {
    const sender = users[Math.floor(Math.random() * users.length)];
    const receiver = users.filter(u => u.id !== sender.id)[Math.floor(Math.random() * (users.length - 1))];
    
    const senderWalletId = walletMap.get(sender.id);
    const receiverWalletId = walletMap.get(receiver.id);
    
    if (!senderWalletId || !receiverWalletId) continue;

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // SEND transaction
    const sendTx = await prisma.transaction.create({
      data: {
        walletId: senderWalletId,
        actionType: TransactionActionType.TIP_SEND,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          recipientUserId: receiver.id,
          recipientName: receiver.profile?.displayName || 'User'
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: hoursAgo(Math.floor(Math.random() * 12))
      }
    });

    // RECEIVE transaction
    await prisma.transaction.create({
      data: {
        walletId: receiverWalletId,
        actionType: TransactionActionType.TIP_RECEIVE,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          senderUserId: sender.id,
          senderName: sender.profile?.displayName || 'User',
          linkedTransactionId: sendTx.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: sendTx.confirmedAt
      }
    });

    count += 2;
  }

  // Dün (3 transfer)
  for (let i = 0; i < 3; i++) {
    const sender = users[Math.floor(Math.random() * users.length)];
    const receiver = users.filter(u => u.id !== sender.id)[Math.floor(Math.random() * (users.length - 1))];
    
    const senderWalletId = walletMap.get(sender.id);
    const receiverWalletId = walletMap.get(receiver.id);
    
    if (!senderWalletId || !receiverWalletId) continue;

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const confirmedAt = daysAgo(1);
    
    const sendTx = await prisma.transaction.create({
      data: {
        walletId: senderWalletId,
        actionType: TransactionActionType.TIP_SEND,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          recipientUserId: receiver.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt
      }
    });

    await prisma.transaction.create({
      data: {
        walletId: receiverWalletId,
        actionType: TransactionActionType.TIP_RECEIVE,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          senderUserId: sender.id,
          linkedTransactionId: sendTx.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt
      }
    });

    count += 2;
  }

  // Geçen hafta (4 transfer)
  for (let i = 0; i < 4; i++) {
    const sender = users[Math.floor(Math.random() * users.length)];
    const receiver = users.filter(u => u.id !== sender.id)[Math.floor(Math.random() * (users.length - 1))];
    
    const senderWalletId = walletMap.get(sender.id);
    const receiverWalletId = walletMap.get(receiver.id);
    
    if (!senderWalletId || !receiverWalletId) continue;

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const confirmedAt = daysAgo(Math.floor(Math.random() * 5) + 2);
    
    const sendTx = await prisma.transaction.create({
      data: {
        walletId: senderWalletId,
        actionType: TransactionActionType.TIP_SEND,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          recipientUserId: receiver.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt
      }
    });

    await prisma.transaction.create({
      data: {
        walletId: receiverWalletId,
        actionType: TransactionActionType.TIP_RECEIVE,
        status: TransactionStatus.confirmed,
        amount: scenario.amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: scenario.reason,
          senderUserId: sender.id,
          linkedTransactionId: sendTx.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt
      }
    });

    count += 2;
  }

  return count;
}

/**
 * Reward claim transaction'ları
 */
async function seedRewardClaims(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  const rewardTypes = [
    { type: 'LADDER', amount: 370, name: 'Ladder Ödülleri' },
    { type: 'SUPPORT', amount: 250, name: 'Birebir Destek Ödülü' },
    { type: 'EVENT', amount: 500, name: 'Event Completion Bonus' }
  ];

  // Her kullanıcıya 1-3 reward claim
  for (const user of users.slice(0, 10)) {
    const walletId = walletMap.get(user.id);
    if (!walletId) continue;

    const rewardCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < rewardCount; i++) {
      const reward = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
      
      await prisma.transaction.create({
        data: {
          walletId,
          actionType: TransactionActionType.CLAIM_REWARD,
          status: TransactionStatus.confirmed,
          amount: reward.amount,
          fromAddress: null,
          toAddress: `0xTIPBOX_${user.id}`,
          metadata: {
            rewardType: reward.type,
            rewardName: reward.name,
            rewardId: `reward_${Date.now()}_${i}`
          },
          provider: 'backend',
          txHash: generateMockTxHash(),
          confirmedAt: daysAgo(Math.floor(Math.random() * 7))
        }
      });

      count++;
    }
  }

  return count;
}

/**
 * Badge claim transaction'ları
 */
async function seedBadgeClaims(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  const badges = await prisma.badge.findMany({ take: 10 });
  if (badges.length === 0) return 0;

  // Her kullanıcıya 1-2 badge claim
  for (const user of users.slice(0, 8)) {
    const walletId = walletMap.get(user.id);
    if (!walletId) continue;

    const badge = badges[Math.floor(Math.random() * badges.length)];
    const amount = Math.floor(Math.random() * 200) + 50;
    
    await prisma.transaction.create({
      data: {
        walletId,
        actionType: TransactionActionType.CLAIM_BADGE,
        status: TransactionStatus.confirmed,
        amount,
        fromAddress: null,
        toAddress: `0xTIPBOX_${user.id}`,
        metadata: {
          badgeId: badge.id,
          badgeName: badge.name,
          badgeType: badge.type
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: daysAgo(Math.floor(Math.random() * 14))
      }
    });

    count++;
  }

  return count;
}

/**
 * NFT transaction'ları
 */
async function seedNFTTransactions(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  const nfts = await prisma.nFT.findMany({ 
    take: 5,
    where: { isTransferable: true }
  });

  if (nfts.length === 0) return 0;

  // NFT alım-satım senaryoları
  for (let i = 0; i < 3; i++) {
    const buyer = users[Math.floor(Math.random() * users.length)];
    const seller = users.filter(u => u.id !== buyer.id)[Math.floor(Math.random() * (users.length - 1))];
    
    const buyerWalletId = walletMap.get(buyer.id);
    const sellerWalletId = walletMap.get(seller.id);
    
    if (!buyerWalletId || !sellerWalletId) continue;

    const nft = nfts[Math.floor(Math.random() * nfts.length)];
    const price = Math.floor(Math.random() * 1000) + 500;
    const gasFee = Math.max(1, price * 0.05);
    const sellerReceives = price - gasFee;

    // Buyer - NFT_BUY
    await prisma.transaction.create({
      data: {
        walletId: buyerWalletId,
        actionType: TransactionActionType.NFT_BUY,
        status: TransactionStatus.confirmed,
        amount: price,
        fromAddress: `0xTIPBOX_${buyer.id}`,
        toAddress: `0xTIPBOX_${seller.id}`,
        metadata: {
          nftId: nft.id,
          nftName: nft.name,
          nftRarity: nft.rarity,
          sellerId: seller.id
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: daysAgo(Math.floor(Math.random() * 10))
      }
    });

    // Seller - NFT_SELL
    await prisma.transaction.create({
      data: {
        walletId: sellerWalletId,
        actionType: TransactionActionType.NFT_SELL,
        status: TransactionStatus.confirmed,
        amount: sellerReceives,
        fromAddress: `0xTIPBOX_${buyer.id}`,
        toAddress: `0xTIPBOX_${seller.id}`,
        metadata: {
          nftId: nft.id,
          nftName: nft.name,
          buyerId: buyer.id,
          originalPrice: price,
          gasFee
        },
        provider: 'backend',
        txHash: generateMockTxHash(),
        confirmedAt: daysAgo(Math.floor(Math.random() * 10))
      }
    });

    count += 2;
  }

  return count;
}

/**
 * Pending transaction'lar (test için)
 */
async function seedPendingTransactions(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  // 2-3 pending transaction
  for (let i = 0; i < 2; i++) {
    const sender = users[Math.floor(Math.random() * users.length)];
    const receiver = users.filter(u => u.id !== sender.id)[Math.floor(Math.random() * (users.length - 1))];
    
    const senderWalletId = walletMap.get(sender.id);
    const receiverWalletId = walletMap.get(receiver.id);
    
    if (!senderWalletId || !receiverWalletId) continue;

    const amount = Math.floor(Math.random() * 100) + 20;
    
    // SEND transaction (PENDING)
    await prisma.transaction.create({
      data: {
        walletId: senderWalletId,
        actionType: TransactionActionType.TIP_SEND,
        status: TransactionStatus.pending,
        amount,
        fromAddress: `0xTIPBOX_${sender.id}`,
        toAddress: `0xTIPBOX_${receiver.id}`,
        metadata: {
          reason: 'Processing...',
          recipientUserId: receiver.id
        },
        provider: 'backend'
      }
    });

    count++;
  }

  return count;
}

/**
 * Failed transaction'lar (test için)
 */
async function seedFailedTransactions(users: any[], walletMap: Map<string, string>): Promise<number> {
  let count = 0;

  const errorScenarios = [
    'Insufficient balance',
    'Network timeout',
    'Invalid recipient address'
  ];

  // 2 failed transaction
  for (let i = 0; i < 2; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const walletId = walletMap.get(user.id);
    if (!walletId) continue;

    await prisma.transaction.create({
      data: {
        walletId,
        actionType: TransactionActionType.TIP_SEND,
        status: TransactionStatus.failed,
        amount: 1000,
        fromAddress: `0xTIPBOX_${user.id}`,
        toAddress: '0xINVALID',
        metadata: {
          reason: 'Test failed transaction'
        },
        provider: 'backend',
        errorMessage: errorScenarios[Math.floor(Math.random() * errorScenarios.length)],
        failedAt: daysAgo(Math.floor(Math.random() * 3))
      }
    });

    count++;
  }

  return count;
}

// Helper functions
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function hoursAgo(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function generateMockTxHash(): string {
  return '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

