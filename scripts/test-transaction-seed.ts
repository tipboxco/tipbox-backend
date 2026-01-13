/**
 * Transaction Seed Test Script
 * 
 * Bu script transaction seed fonksiyonlarını test eder.
 * 
 * Kullanım:
 *   npx ts-node scripts/test-transaction-seed.ts
 */

import { getPrisma } from '../src/infrastructure/database/prisma-client';

const prisma = getPrisma();

async function testTransactionSeed() {
  console.log('🧪 Testing Transaction Seed Functions...\n');

  try {
    // 1. Kullanıcıları kontrol et
    console.log('1️⃣ Kullanıcı sayısını kontrol ediyorum...');
    const userCount = await prisma.user.count();
    console.log(`   ✅ ${userCount} kullanıcı bulundu\n`);

    if (userCount < 2) {
      console.error('   ❌ Test için en az 2 kullanıcı gerekli. Önce seed.ts çalıştırın.');
      process.exit(1);
    }

    // 2. Mevcut wallet sayısını kontrol et
    console.log('2️⃣ Mevcut wallet sayısını kontrol ediyorum...');
    const walletCountBefore = await prisma.wallet.count();
    console.log(`   📊 Mevcut wallet sayısı: ${walletCountBefore}\n`);

    // 3. Mevcut transaction sayısını kontrol et
    console.log('3️⃣ Mevcut transaction sayısını kontrol ediyorum...');
    const transactionCountBefore = await prisma.transaction.count();
    console.log(`   📊 Mevcut transaction sayısı: ${transactionCountBefore}\n`);

    // 4. Transaction seed'i çalıştır
    console.log('4️⃣ Transaction seed fonksiyonunu çalıştırıyorum...\n');
    
    const { seedTransactions } = await import('../prisma/seed/transaction-seed');
    const result = await seedTransactions();

    console.log('\n✅ Transaction Seed Tamamlandı!\n');
    console.log('═════════════════════════════════════════');
    console.log('📊 SEED SONUÇLARI');
    console.log('═════════════════════════════════════════');
    console.log(`Oluşturulan Wallet Sayısı: ${result.totalWallets}`);
    console.log(`Oluşturulan Transaction Sayısı: ${result.totalTransactions}`);
    console.log('\n📈 Transaction Tipleri:');
    Object.entries(result.byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    console.log('\n📊 Transaction Durumları:');
    Object.entries(result.byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('═════════════════════════════════════════\n');

    // 5. Yeni durumu kontrol et
    console.log('5️⃣ Yeni durum kontrolü...');
    const walletCountAfter = await prisma.wallet.count();
    const transactionCountAfter = await prisma.transaction.count();

    console.log(`   📊 Toplam wallet sayısı: ${walletCountAfter} (önceki: ${walletCountBefore})`);
    console.log(`   📊 Toplam transaction sayısı: ${transactionCountAfter} (önceki: ${transactionCountBefore})\n`);

    // 6. Örnek transaction'ları göster
    console.log('6️⃣ Örnek transaction'lar...\n');
    
    const sampleTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                profile: {
                  select: {
                    displayName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    sampleTransactions.forEach((tx, index) => {
      const userName = tx.wallet.user.profile?.displayName || 'Unknown User';
      console.log(`   ${index + 1}. ${tx.actionType} - ${tx.amount} TIPS - ${tx.status}`);
      console.log(`      Kullanıcı: ${userName}`);
      console.log(`      Tarih: ${tx.confirmedAt || tx.createdAt}`);
      if (tx.metadata && typeof tx.metadata === 'object') {
        console.log(`      Meta: ${JSON.stringify(tx.metadata)}`);
      }
      console.log('');
    });

    // 7. Wallet bakiyelerini göster
    console.log('7️⃣ Örnek wallet bakiyeleri (hesaplanan)...\n');
    
    const sampleWallets = await prisma.wallet.findMany({
      take: 5,
      include: {
        user: {
          select: {
            profile: {
              select: {
                displayName: true
              }
            }
          }
        },
        transactions: {
          where: {
            status: 'CONFIRMED'
          }
        }
      }
    });

    for (const wallet of sampleWallets) {
      const userName = wallet.user.profile?.displayName || 'Unknown User';
      
      // Bakiye hesapla
      let balance = 0;
      
      for (const tx of wallet.transactions) {
        if (tx.actionType === 'TIP_RECEIVE' || 
            tx.actionType === 'AIRDROP' || 
            tx.actionType === 'CLAIM_REWARD' || 
            tx.actionType === 'CLAIM_BADGE' ||
            tx.actionType === 'NFT_SELL') {
          balance += tx.amount || 0;
        } else if (tx.actionType === 'TIP_SEND' || 
                   tx.actionType === 'NFT_BUY' ||
                   tx.actionType === 'SWAP_TIP_TO_SOL') {
          balance -= tx.amount || 0;
        }
      }
      
      console.log(`   👤 ${userName}`);
      console.log(`      Bakiye: ${balance.toFixed(2)} TIPS`);
      console.log(`      Transaction Sayısı: ${wallet.transactions.length}`);
      console.log('');
    }

    console.log('🎉 Test başarıyla tamamlandı!\n');

  } catch (error) {
    console.error('\n❌ Test sırasında hata oluştu:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
testTransactionSeed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

