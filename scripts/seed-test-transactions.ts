import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { TransactionActionType } from '../src/domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../src/domain/transaction/transaction-status.enum';

const prisma = getPrisma();

const TEST_USER_ID = '44444444-4444-4444-a444-444444444444';
const TEST_WALLET_ID = '384c741b-1cb8-46f4-a9b4-2f000c944531';

async function seedTestTransactions() {
  console.log('Test transactions olusturuluyor...');
  console.log(`   User ID: ${TEST_USER_ID}`);
  console.log(`   Wallet ID: ${TEST_WALLET_ID}`);

  // Diğer kullanıcıları al (tip gönderme/alma için)
  const otherUsers = await prisma.user.findMany({
    where: {
      id: { not: TEST_USER_ID }
    },
    take: 10,
    include: {
      wallets: true
    }
  });

  if (otherUsers.length === 0) {
    console.error('Baska kullanici bulunamadi!');
    return;
  }

  const transactions = [];
  const now = new Date();

  // 1. TIP RECEIVE - Gecen hafta aldigi tipler (5 adet)
  console.log('\n1. TIP RECEIVE transactions...');
  for (let i = 0; i < 5; i++) {
    const sender = otherUsers[i % otherUsers.length];
    const amount = Math.floor(Math.random() * 500) + 100; // 100-600 TIPS
    const daysAgo = Math.floor(Math.random() * 7) + 1; // 1-7 gun once
    
    transactions.push({
      walletId: TEST_WALLET_ID,
      actionType: TransactionActionType.TIP_RECEIVE,
      status: TransactionStatus.CONFIRMED,
      amount,
      fromAddress: sender.wallets[0]?.publicAddress || `0xSENDER_${sender.id}`,
      toAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
      metadata: {
        senderUserId: sender.id,
        recipientUserId: TEST_USER_ID,
        reason: `Great post #${i + 1}! 🎉`
      },
      txHash: `0xTIPRECEIVE${i}_${Date.now()}`,
      provider: 'backend',
      errorMessage: null,
      createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + 5000),
      failedAt: null
    });
  }

  // 2. TIP SEND - Bugun gonderdigi tipler (3 adet)
  console.log('2. TIP SEND transactions...');
  for (let i = 0; i < 3; i++) {
    const recipient = otherUsers[(i + 5) % otherUsers.length];
    const amount = Math.floor(Math.random() * 300) + 50; // 50-350 TIPS
    const hoursAgo = Math.floor(Math.random() * 12) + 1; // 1-12 saat once
    
    transactions.push({
      walletId: TEST_WALLET_ID,
      actionType: TransactionActionType.TIP_SEND,
      status: TransactionStatus.CONFIRMED,
      amount,
      fromAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
      toAddress: recipient.wallets[0]?.publicAddress || `0xRECIPIENT_${recipient.id}`,
      metadata: {
        senderUserId: TEST_USER_ID,
        recipientUserId: recipient.id,
        reason: `Thanks for the advice! 💡`
      },
      txHash: `0xTIPSEND${i}_${Date.now()}`,
      provider: 'backend',
      errorMessage: null,
      createdAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000),
      confirmedAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000 + 3000),
      failedAt: null
    });
  }

  // 3. CLAIM_REWARD - Event odulu (2 adet)
  console.log('3. CLAIM_REWARD transactions...');
  for (let i = 0; i < 2; i++) {
    const amount = 1000; // Fixed reward amount
    const daysAgo = Math.floor(Math.random() * 5) + 1;
    
    transactions.push({
      walletId: TEST_WALLET_ID,
      actionType: TransactionActionType.CLAIM_REWARD,
      status: TransactionStatus.CONFIRMED,
      amount,
      fromAddress: null,
      toAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
      metadata: {
        recipientUserId: TEST_USER_ID,
        eventId: `event_${i + 1}`,
        rewardType: 'event_participation'
      },
      txHash: `0xREWARD${i}_${Date.now()}`,
      provider: 'backend',
      errorMessage: null,
      createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + 2000),
      failedAt: null
    });
  }

  // 4. CLAIM_BADGE - Badge kazanimi (1 adet)
  console.log('4. CLAIM_BADGE transaction...');
  transactions.push({
    walletId: TEST_WALLET_ID,
    actionType: TransactionActionType.CLAIM_BADGE,
    status: TransactionStatus.CONFIRMED,
    amount: 500,
    fromAddress: null,
    toAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
    metadata: {
      recipientUserId: TEST_USER_ID,
      badgeId: 'expert_badge_1',
      badgeName: 'Expert Reviewer'
    },
    txHash: `0xBADGE_${Date.now()}`,
    provider: 'backend',
    errorMessage: null,
    createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    confirmedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2000),
    failedAt: null
  });

  // 5. AIRDROP - Ilk kullanici bonusu (1 adet)
  console.log('5. AIRDROP transaction...');
  transactions.push({
    walletId: TEST_WALLET_ID,
    actionType: TransactionActionType.AIRDROP,
    status: TransactionStatus.CONFIRMED,
    amount: 2000,
    fromAddress: null,
    toAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
    metadata: {
      recipientUserId: TEST_USER_ID,
      airdropType: 'welcome_bonus',
      description: 'Welcome to Tipbox! 🎉'
    },
    txHash: `0xAIRDROP_${Date.now()}`,
    provider: 'backend',
    errorMessage: null,
    createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 2 hafta once
    confirmedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 1000),
    failedAt: null
  });

  // 6. PENDING - Bekleyen transaction (1 adet)
  console.log('6. PENDING transaction...');
  transactions.push({
    walletId: TEST_WALLET_ID,
    actionType: TransactionActionType.TIP_RECEIVE,
    status: TransactionStatus.PENDING,
    amount: 250,
    fromAddress: otherUsers[0].wallets[0]?.publicAddress || `0xSENDER_${otherUsers[0].id}`,
    toAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
    metadata: {
      senderUserId: otherUsers[0].id,
      recipientUserId: TEST_USER_ID,
      reason: 'Processing...'
    },
    txHash: null,
    provider: 'backend',
    errorMessage: null,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 dakika once
    confirmedAt: null,
    failedAt: null
  });

  // 7. FAILED - Basarisiz transaction (1 adet)
  console.log('7. FAILED transaction...');
  transactions.push({
    walletId: TEST_WALLET_ID,
    actionType: TransactionActionType.TIP_SEND,
    status: TransactionStatus.FAILED,
    amount: 100,
    fromAddress: `0xTIPBOX_${TEST_USER_ID}_${Date.now()}`,
    toAddress: otherUsers[1].wallets[0]?.publicAddress || `0xRECIPIENT_${otherUsers[1].id}`,
    metadata: {
      senderUserId: TEST_USER_ID,
      recipientUserId: otherUsers[1].id,
      reason: 'Test failed transaction'
    },
    txHash: null,
    provider: 'backend',
    errorMessage: 'Insufficient balance at the time',
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 saat once
    confirmedAt: null,
    failedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 10000)
  });

  // Transaction'lari veritabanina ekle
  console.log('\nTransactions veritabanina ekleniyor...');
  const created = await prisma.transaction.createMany({
    data: transactions
  });

  console.log(`${created.count} transaction olusturuldu!`);

  // Balance hesapla
  const allTransactions = await prisma.transaction.findMany({
    where: {
      walletId: TEST_WALLET_ID,
      status: TransactionStatus.CONFIRMED
    }
  });

  let balance = 0;
  for (const tx of allTransactions) {
    if (!tx.amount) continue;

    const actionType = tx.actionType as TransactionActionType;
    
    // Add to balance
    if ([
      TransactionActionType.TIP_RECEIVE,
      TransactionActionType.CLAIM_REWARD,
      TransactionActionType.CLAIM_BADGE,
      TransactionActionType.AIRDROP
    ].includes(actionType)) {
      balance += tx.amount;
    }
    // Subtract from balance
    else if ([
      TransactionActionType.TIP_SEND,
      TransactionActionType.NFT_BUY,
      TransactionActionType.FEE
    ].includes(actionType)) {
      balance -= tx.amount;
    }
  }

  console.log('\nOzet:');
  console.log(`   Total Transactions: ${allTransactions.length}`);
  console.log(`   Current Balance: ${balance} TIPS`);
  console.log(`   Pending: 1 transaction`);
  console.log(`   Failed: 1 transaction`);
  
  console.log('\nTest Endpointleri:');
  console.log(`   GET /wallets/balance - Balance kontrolu`);
  console.log(`   GET /transactions/history?limit=20 - Transaction listesi`);
  console.log(`   GET /transactions/history/grouped - Tarih gruplu transaction`);
  console.log(`   GET /wallets/info - Wallet bilgisi`);
}

// Run the seed
seedTestTransactions()
  .then(() => {
    console.log('\nTest verisi basariyla olusturuldu!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Hata:', error);
    process.exit(1);
  });

