/**
 * provision-wallets.ts
 *
 * Walletı olmayan tüm kullanıcıları bulur, her biri için Thirdweb wallet oluşturur
 * ve welcome deposit gönderir. Ardından sonuçları validate eder.
 *
 * Çalıştırma (Docker içinden):
 *   docker-compose exec backend npx ts-node scripts/provision-wallets.ts
 *
 * Çalıştırma (yerel, .env yüklü ortamda):
 *   npx ts-node -r dotenv/config scripts/provision-wallets.ts
 */

import { getPrisma, disconnectPrisma } from '../src/infrastructure/repositories/prisma.client';
import { WalletService } from '../src/application/wallet/wallet.service';

const prisma = getPrisma();
const walletService = new WalletService();

interface UserRow {
  id: string;
  email: string | null;
  fullName: string | null;
}

interface Result {
  userId: string;
  email: string | null;
  status: 'created' | 'already_exists' | 'no_smart_account' | 'no_wallet_after_create' | 'error';
  smartAccountAddress: string | null;
  balance: number | null;
  hasWelcomeDeposit: boolean;
  error?: string;
}

async function findUsersWithoutWallets(): Promise<UserRow[]> {
  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT u.id, u.email, u.full_name AS "fullName"
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM wallets w WHERE w.user_id = u.id
    )
    ORDER BY u.created_at ASC
  `;
  return rows;
}

async function validateWallet(userId: string): Promise<{
  smartAccountAddress: string | null;
  balance: number | null;
  hasWelcomeDeposit: boolean;
}> {
  const wallets = await prisma.wallet.findMany({ where: { userId } });
  if (wallets.length === 0) {
    return { smartAccountAddress: null, balance: null, hasWelcomeDeposit: false };
  }

  const wallet = wallets.find((w) => w.smartAccountAddress) ?? wallets[0];

  const depositTx = await prisma.transaction.findFirst({
    where: {
      walletId: wallet.id,
      metadata: { path: ['source'], equals: 'welcome_deposit' },
    },
  });

  return {
    smartAccountAddress: wallet.smartAccountAddress ?? null,
    balance: Number(wallet.balance),
    hasWelcomeDeposit: !!depositTx,
  };
}

async function main() {
  console.log('=== provision-wallets başladı ===\n');

  const usersWithoutWallet = await findUsersWithoutWallets();

  if (usersWithoutWallet.length === 0) {
    console.log('✅ Tüm kullanıcıların walletı var, işlem gerekmez.');
    return;
  }

  console.log(`📋 Walletsız kullanıcı sayısı: ${usersWithoutWallet.length}\n`);

  const results: Result[] = [];

  for (let i = 0; i < usersWithoutWallet.length; i++) {
    const user = usersWithoutWallet[i];
    const prefix = `[${i + 1}/${usersWithoutWallet.length}] ${user.email ?? user.id}`;

    // Check if already has a wallet (concurrent run guard)
    const existingWallets = await prisma.wallet.findMany({ where: { userId: user.id } });
    if (existingWallets.length > 0) {
      const validation = await validateWallet(user.id);
      results.push({
        userId: user.id,
        email: user.email,
        status: 'already_exists',
        ...validation,
      });
      console.log(`⚠️  ${prefix} — zaten wallet var, atlandı`);
      continue;
    }

    try {
      console.log(`⏳ ${prefix} — wallet oluşturuluyor...`);
      // ensureWalletForUser: Thirdweb auth + connectWallet + welcome deposit
      await walletService.ensureWalletForUser(user.id);

      const validation = await validateWallet(user.id);

      if (!validation.smartAccountAddress && validation.balance === null) {
        // Wallet hâlâ yok (SDK yapılandırılmamış ya da Thirdweb oturumu yok)
        results.push({
          userId: user.id,
          email: user.email,
          status: 'no_wallet_after_create',
          smartAccountAddress: null,
          balance: null,
          hasWelcomeDeposit: false,
        });
        console.log(`❌ ${prefix} — wallet oluşturulamadı (SDK/session yok?)`);
        continue;
      }

      if (!validation.smartAccountAddress) {
        results.push({
          userId: user.id,
          email: user.email,
          status: 'no_smart_account',
          ...validation,
        });
        console.log(`⚠️  ${prefix} — wallet var ama smartAccountAddress yok, deposit bekleniyor`);
        continue;
      }

      results.push({
        userId: user.id,
        email: user.email,
        status: 'created',
        ...validation,
      });

      const depositMark = validation.hasWelcomeDeposit ? '✅' : '⚠️ (deposit yok)';
      console.log(
        `✅ ${prefix} — wallet oluşturuldu | smartAccount: ${validation.smartAccountAddress?.slice(0, 10)}... | balance: ${validation.balance} TIPS | deposit: ${depositMark}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        userId: user.id,
        email: user.email,
        status: 'error',
        smartAccountAddress: null,
        balance: null,
        hasWelcomeDeposit: false,
        error: message,
      });
      console.error(`❌ ${prefix} — hata: ${message}`);
    }

    // Small delay between users to avoid rate limiting on Thirdweb
    if (i < usersWithoutWallet.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== ÖZET ===');
  const created = results.filter((r) => r.status === 'created');
  const alreadyExists = results.filter((r) => r.status === 'already_exists');
  const noSmartAccount = results.filter((r) => r.status === 'no_smart_account');
  const noWallet = results.filter((r) => r.status === 'no_wallet_after_create');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`Toplam işlenen       : ${results.length}`);
  console.log(`✅ Yeni wallet + deposit: ${created.length}`);
  console.log(`⚠️  Zaten vardı          : ${alreadyExists.length}`);
  console.log(`⚠️  Smart account yok    : ${noSmartAccount.length}`);
  console.log(`❌ Wallet oluşturulamadı: ${noWallet.length}`);
  console.log(`❌ Hata                  : ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n=== HATALAR ===');
    for (const r of errors) {
      console.log(`  ${r.email ?? r.userId}: ${r.error}`);
    }
  }

  if (noWallet.length > 0) {
    console.log('\n=== WALLET OLUŞTURULAMAYAN KULLANICILAR ===');
    for (const r of noWallet) {
      console.log(`  ${r.email ?? r.userId}`);
    }
  }

  const depositMissing = created.filter((r) => !r.hasWelcomeDeposit);
  if (depositMissing.length > 0) {
    console.log('\n⚠️  Welcome deposit kaydı olmayan yeni walletlar:');
    for (const r of depositMissing) {
      console.log(`  ${r.email ?? r.userId} | balance: ${r.balance}`);
    }
  }

  console.log('\n=== provision-wallets tamamlandı ===');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
