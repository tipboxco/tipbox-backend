/**
 * MinIO badges/custom içindeki görselleri Badge tablosu ile eşleştirir.
 * - imageUrl boş olan badge'leri günceller.
 * - Önce isim ilişkisi ile eşleştirir (badge.name ile dosya adı normalize edilerek).
 * - Eşleşmeyenlere kalan görseller rastgele dağıtılır.
 *
 * Kullanım (backend klasöründen):
 *   npm run sync-badge-images
 *   veya: npx ts-node scripts/sync-badge-images-from-minio.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';

const BADGES_CUSTOM_PREFIX = 'badges/custom/';

const prisma = new PrismaClient();

/**
 * İsim eşleştirmesi için normalize: küçük harf, boşluk ve özel karakterler kaldırılır.
 * Örn: "Crimson Roast" -> "crimsonroast", "Trend Spotter" -> "trendspotter"
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Key'den dosya adı (uzantısız) döner. Örn: "badges/custom/CrimsonRoast.png" -> "CrimsonRoast"
 */
function keyToFileNameWithoutExt(key: string): string {
  const base = key.startsWith(BADGES_CUSTOM_PREFIX)
    ? key.slice(BADGES_CUSTOM_PREFIX.length)
    : key.split('/').pop() ?? key;
  const lastDot = base.lastIndexOf('.');
  return lastDot > 0 ? base.slice(0, lastDot) : base;
}

/**
 * Fisher-Yates shuffle (array'i yerinde karıştırır)
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main(): Promise<void> {
  console.log('🔄 MinIO badges/custom ile Badge tablosu eşleştirmesi başlıyor...\n');

  const s3Service = new S3Service();

  // 1. MinIO'da badges/custom altındaki tüm key'leri al
  const allKeys = await s3Service.listObjectKeys(BADGES_CUSTOM_PREFIX);
  const imagePaths = allKeys.filter(
    (k) => k.length > BADGES_CUSTOM_PREFIX.length && !k.endsWith('/')
  );

  if (imagePaths.length === 0) {
    console.log('⚠️  badges/custom altında hiç görsel bulunamadı. İşlem sonlandı.');
    return;
  }

  console.log(`📁 MinIO'da ${imagePaths.length} görsel bulundu.\n`);

  // 2. imageUrl boş veya null olan badge'leri al
  const badgesWithoutImage = await prisma.badge.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: '' }],
    },
    orderBy: { name: 'asc' },
  });

  if (badgesWithoutImage.length === 0) {
    console.log('✅ imageUrl boş olan badge yok. Güncelleme yapılmadı.');
    return;
  }

  console.log(`🏅 imageUrl boş olan ${badgesWithoutImage.length} badge bulundu.\n`);

  // 3. Dosya adı (uzantısız) -> key map (normalize edilmiş key ile arama için)
  const normalizedToPath = new Map<string, string>();
  for (const path of imagePaths) {
    const nameOnly = keyToFileNameWithoutExt(path);
    const normalized = normalizeForMatch(nameOnly);
    if (!normalizedToPath.has(normalized)) {
      normalizedToPath.set(normalized, path);
    }
  }

  // 4. İsim eşleşmesi: badge name normalize edilerek dosya bulunur
  const usedPaths = new Set<string>();
  const assignments: { badgeId: string; badgeName: string; imagePath: string; byName: boolean }[] =
    [];

  for (const badge of badgesWithoutImage) {
    const normalizedName = normalizeForMatch(badge.name);
    const matchedPath = normalizedToPath.get(normalizedName);
    if (matchedPath && !usedPaths.has(matchedPath)) {
      usedPaths.add(matchedPath);
      assignments.push({
        badgeId: badge.id,
        badgeName: badge.name,
        imagePath: matchedPath,
        byName: true,
      });
    }
  }

  // 5. Eşleşmeyen badge'ler için tüm görselleri rastgele dağıt (gerekirse tekrar kullan)
  const assignedBadgeIds = new Set(assignments.map((a) => a.badgeId));
  const badgesNeedingRandom = badgesWithoutImage.filter((b) => !assignedBadgeIds.has(b.id));
  const shuffledPool = shuffle(imagePaths);

  for (let i = 0; i < badgesNeedingRandom.length; i++) {
    const badge = badgesNeedingRandom[i];
    const imagePath = shuffledPool[i % shuffledPool.length];
    assignments.push({
      badgeId: badge.id,
      badgeName: badge.name,
      imagePath,
      byName: false,
    });
  }

  // 6. Veritabanını güncelle
  let updated = 0;
  for (const { badgeId, badgeName, imagePath, byName } of assignments) {
    await prisma.badge.update({
      where: { id: badgeId },
      data: { imageUrl: imagePath },
    });
    updated++;
    console.log(
      `   ${byName ? '📌' : '🎲'} ${badgeName} → ${imagePath} ${byName ? '(isim eşleşmesi)' : '(rastgele)'}`
    );
  }

  console.log(`\n✅ ${updated} badge'in imageUrl alanı güncellendi.`);
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
