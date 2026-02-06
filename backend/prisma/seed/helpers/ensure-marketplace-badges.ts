/**
 * Marketplace badge'lerini oluşturur ve görsellerini MinIO'ya yükler
 */

import { PrismaClient, BadgeRarity, BadgeType } from '@prisma/client';
import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { promises as fs } from 'fs';
import path from 'path';

interface MarketplaceBadgeConfig {
  name: string;
  description: string;
  rarity: BadgeRarity;
  type: BadgeType;
}

const MARKETPLACE_BADGE_CONFIGS: MarketplaceBadgeConfig[] = [
  // Achievement Badges
  {
    name: 'Early Adopter',
    description: 'Tipbox\'a ilk katılanlardan birisiniz!',
    rarity: BadgeRarity.EPIC,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Beta Tester',
    description: 'Beta testlerinde aktif rol aldınız!',
    rarity: BadgeRarity.EPIC,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'İlk Post',
    description: 'İlk postunu paylaştın!',
    rarity: BadgeRarity.COMMON,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Sosyal Kelebek',
    description: '10 kişiyi takip ettin!',
    rarity: BadgeRarity.COMMON,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'İçerik Üreticisi',
    description: '50 post paylaştın!',
    rarity: BadgeRarity.RARE,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Topluluk Lideri',
    description: '100 takipçiye ulaştın!',
    rarity: BadgeRarity.EPIC,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Güvenilir Kullanıcı',
    description: 'Topluluğun güvendiği bir üyesiniz!',
    rarity: BadgeRarity.RARE,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Doğrulanmış Uzman',
    description: 'Uzmanlığınız doğrulandı!',
    rarity: BadgeRarity.EPIC,
    type: BadgeType.ACHIEVEMENT
  },
  {
    name: 'Apple Uzmanı',
    description: 'Apple ürünleri konusunda uzman!',
    rarity: BadgeRarity.RARE,
    type: BadgeType.COSMETIC
  },
  {
    name: 'Samsung İçerik Üreticisi',
    description: 'Samsung içeriklerinde aktifsin!',
    rarity: BadgeRarity.RARE,
    type: BadgeType.COSMETIC
  }
];

export async function ensureMarketplaceBadges(prisma: PrismaClient): Promise<void> {
  console.log('\n🎨 Marketplace Badge\'leri Hazırlanıyor...\n');

  const s3Service = new S3Service();

  try {
    // 1. Badge Kategorilerini Oluştur
    const categoryMap = new Map<BadgeType, string>();

    const categories = [
      { name: 'Achievement', type: BadgeType.ACHIEVEMENT, description: 'Belirli başarılara ulaşan kullanıcılar için' },
      { name: 'Cosmetic', type: BadgeType.COSMETIC, description: 'Özel görünüm rozetleri' }
    ];

    for (const cat of categories) {
      let category = await prisma.badgeCategory.findFirst({
        where: { name: cat.name }
      });

      if (!category) {
        category = await prisma.badgeCategory.create({
          data: {
            name: cat.name,
            description: cat.description
          }
        });
        console.log(`✅ Kategori: ${cat.name}`);
      } else {
        console.log(`⏭️  Kategori zaten var: ${cat.name}`);
      }

      categoryMap.set(cat.type, category.id);
    }

    // 2. Marketplace Badge Görsellerini MinIO'ya Yükle
    console.log('\n📤 Marketplace Badge Görselleri MinIO\'ya Yükleniyor...\n');

    const marketplaceBadgesPath = path.join(__dirname, '../../../tests/assets/badge');
    const uploadedImages: string[] = [];

    try {
      const entries = await fs.readdir(marketplaceBadgesPath, { withFileTypes: true });
      // Sadece dosyaları al (klasörleri atla: brandbadges, eventbadges)
      const pngFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.png'))
        .map(entry => entry.name);

      for (const file of pngFiles) {
        const localPath = path.join(marketplaceBadgesPath, file);
        const targetKey = `badges/custom/${file}`;

        const exists = await s3Service.fileExists(targetKey);

        if (!exists) {
          const fileBuffer = await fs.readFile(localPath);
          await s3Service.uploadFile(targetKey, fileBuffer, 'image/png');
          console.log(`   ✅ ${file} → ${targetKey}`);
        } else {
          console.log(`   ⏭️  ${file} zaten mevcut`);
        }

        uploadedImages.push(targetKey);
      }

      console.log(`\n✅ ${uploadedImages.length} marketplace badge görseli hazır\n`);
    } catch (error) {
      console.warn('⚠️  Marketplace badge görselleri yüklenemedi, devam ediliyor...');
      console.warn('   Hata:', error instanceof Error ? error.message : String(error));
    }

    // 3. Marketplace Badge'leri Oluştur
    console.log('🏅 Marketplace Badge\'leri Oluşturuluyor...\n');

    let badgeIndex = 0;

    for (const config of MARKETPLACE_BADGE_CONFIGS) {
      const categoryId = categoryMap.get(config.type);

      if (!categoryId) {
        console.warn(`⚠️  Kategori bulunamadı: ${config.type}, atlanıyor...`);
        continue;
      }

      let badge = await prisma.badge.findFirst({
        where: { name: config.name }
      });

      if (!badge) {
        // Döngüsel olarak görselleri ata
        const imageUrl = uploadedImages.length > 0 
          ? uploadedImages[badgeIndex % uploadedImages.length]
          : null;

        badge = await prisma.badge.create({
          data: {
            name: config.name,
            description: config.description,
            imageUrl,
            type: config.type,
            rarity: config.rarity,
            categoryId
          }
        });
        console.log(`   ✅ ${badge.name} (${config.type})`);
        badgeIndex++;
      } else {
        console.log(`   ⏭️  ${badge.name} zaten var`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Marketplace Badge\'leri Hazır!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   📊 Badge Sayısı: ${MARKETPLACE_BADGE_CONFIGS.length}`);
    console.log(`   📊 Kategori Sayısı: ${categoryMap.size}`);
    console.log(`   📊 Görsel Sayısı: ${uploadedImages.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Marketplace Badge\'leri hazırlanırken hata:', error);
    throw error;
  }
}
