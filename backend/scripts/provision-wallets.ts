/**
 * provision-wallets.ts — Manuel çalıştırma scripti
 *
 * Thirdweb smart account adresi olmayan tüm kullanıcılar için yeni gerçek wallet
 * oluşturur ve welcome deposit gönderir. Var olan mock wallet kayıtlarına dokunmaz.
 *
 * Çalıştırma (Docker içinden):
 *   docker-compose exec backend npx ts-node scripts/provision-wallets.ts
 *
 * Çalıştırma (yerel, .env yüklü ortamda):
 *   npx ts-node -r dotenv/config scripts/provision-wallets.ts
 */

import { getPrisma, disconnectPrisma } from '../src/infrastructure/repositories/prisma.client';
import { WalletPrismaRepository } from '../src/infrastructure/repositories/wallet-prisma.repository';
import { WelcomeDepositService } from '../src/application/wallet/welcome-deposit.service';
import {
  getWalletProvider,
  getActiveWalletProviderEnum,
} from '../src/application/wallet/provider/wallet-provider.factory';

const prisma = getPrisma();
const walletRepo = new WalletPrismaRepository();

interface UserRow {
  id: string;
  email: string | null;
}

async function main() {
  console.log('=== provision-wallets başladı ===\n');

  const provider = getWalletProvider();
  if (!provider.isConfigured()) {
    console.error('❌ Wallet provider yapılandırılmamış. .env dosyasını kontrol edin.');
    process.exit(1);
  }

  const users = await prisma.$queryRaw<UserRow[]>`
    SELECT u.id, u.email
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM wallets w
      WHERE w.user_id = u.id
        AND w.provider != 'CUSTOM'
    )
    ORDER BY u.created_at ASC
  `;

  if (users.length === 0) {
    console.log('✅ Tüm kullanıcıların Thirdweb smart account adresi var, işlem gerekmez.');
    return;
  }

  console.log(`📋 Smart account adresi olmayan kullanıcı sayısı: ${users.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const prefix = `[${i + 1}/${users.length}] ${user.email ?? user.id}`;

    try {
      const auth = await provider.authenticateAndGetAddresses(user.id);

      if (!auth.success || !auth.eoaAddress || !auth.smartAccountAddress) {
        console.warn(`⚠️  ${prefix} — Thirdweb adres alınamadı, atlandı`);
        skipped++;
        continue;
      }

      // Zaten kayıtlı mı?
      const existingWithSmart = await walletRepo.findBySmartAccountAddress(auth.smartAccountAddress);
      if (existingWithSmart) {
        console.log(`⚠️  ${prefix} — smart account zaten kayıtlı, atlandı`);
        skipped++;
        continue;
      }

      // Yeni gerçek wallet oluştur (var olan mock kayıtlara dokunmadan)
      const newWallet = await walletRepo.create(
        user.id,
        auth.eoaAddress,
        getActiveWalletProviderEnum(),
        true,
        auth.smartAccountAddress,
      );

      // Welcome deposit kontrolü (tüm walletlar üzerinde)
      const allWallets = await prisma.wallet.findMany({ where: { userId: user.id } });
      const allWalletIds = allWallets.map((w) => w.id);

      const hasDeposit = await prisma.transaction.findFirst({
        where: {
          walletId: { in: allWalletIds },
          metadata: { path: ['source'], equals: 'welcome_deposit' },
        },
      });

      if (!hasDeposit) {
        await new WelcomeDepositService().grant(user.id, newWallet.id);
        console.log(
          `✅ ${prefix} — wallet oluşturuldu + welcome deposit gönderildi | ${auth.smartAccountAddress.slice(0, 12)}...`,
        );
      } else {
        console.log(
          `✅ ${prefix} — wallet oluşturuldu (deposit zaten var) | ${auth.smartAccountAddress.slice(0, 12)}...`,
        );
      }

      created++;
    } catch (err) {
      failed++;
      console.error(`❌ ${prefix} — hata: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n=== ÖZET ===');
  console.log(`Toplam işlenen     : ${users.length}`);
  console.log(`✅ Wallet oluşturuldu: ${created}`);
  console.log(`⚠️  Atlandı           : ${skipped}`);
  console.log(`❌ Hata              : ${failed}`);
  console.log('\n=== provision-wallets tamamlandı ===');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
