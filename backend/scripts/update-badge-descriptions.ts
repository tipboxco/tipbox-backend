/**
 * Script: Update Event Badge Descriptions
 * 
 * Badge description'larını daha açıklayıcı ve nasıl kazanılacağını
 * anlatan formata günceller.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BadgeUpdate {
  name: string;
  description: string;
}

const BADGE_UPDATES: BadgeUpdate[] = [
  // Post Badges
  {
    name: '[Event] İlk Adım',
    description: 'Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event\'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor!',
  },
  {
    name: '[Event] Aktif Katılımcı',
    description: 'Event\'te toplam 3 post paylaştın! 🔥 İçerik üretmeye devam ediyorsun. Topluluğa katkıların için teşekkürler. Bir sonraki seviyeye ulaşmak için 2 post daha paylaş!',
  },
  {
    name: '[Event] İçerik Ustası',
    description: 'Event\'te toplam 5 post paylaştın! ⭐ Harika bir içerik üreticisisin! Event boyunca düzenli ve kaliteli paylaşımların topluluğa değer katıyor. Bu başarı için tebrikler!',
  },
  // Likes Received Badges
  {
    name: '[Event] İlk Beğeni',
    description: 'Event\'te paylaştığın bir içerik ilk beğenisini aldı! 👍 Başkaları senin paylaşımlarını değerli buluyor. Devam et, daha fazla beğeni kazanabilirsin!',
  },
  {
    name: '[Event] Popüler',
    description: 'Event\'te paylaştığın içerikler toplam 3 beğeni aldı! 🌟 İçerikleriniz diğer kullanıcılar tarafından beğeniliyor. Kaliteli paylaşımlarına devam et!',
  },
  {
    name: '[Event] Viral Oldu',
    description: 'Event\'te paylaştığın içerikler toplam 5 beğeni aldı! 💫 Tam bir içerik yıldızısın! Paylaşımların toplulukta yankı buluyor ve ilham veriyor. Muhteşem bir başarı!',
  },
];

async function main() {
  console.log('\n📝 Updating Event Badge Descriptions...\n');

  try {
    let updatedCount = 0;

    for (const update of BADGE_UPDATES) {
      // Badge'i bul
      const badge = await prisma.badge.findFirst({
        where: { name: update.name },
        select: { id: true, name: true, description: true },
      });

      if (!badge) {
        console.log(`⚠️  Badge not found: ${update.name}`);
        continue;
      }

      // Description'ı güncelle
      await prisma.badge.update({
        where: { id: badge.id },
        data: { description: update.description },
      });

      console.log(`✅ Updated: ${update.name}`);
      console.log(`   Old: ${badge.description}`);
      console.log(`   New: ${update.description}\n`);

      updatedCount++;
    }

    console.log(`\n✅ Updated ${updatedCount}/${BADGE_UPDATES.length} badges\n`);

    // Sonuçları göster
    console.log('📋 Final Badge Descriptions:\n');
    const badges = await prisma.badge.findMany({
      where: {
        type: 'EVENT',
      },
      select: {
        name: true,
        description: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    badges.forEach((badge, index) => {
      console.log(`${index + 1}. ${badge.name}`);
      console.log(`   ${badge.description}\n`);
    });

    console.log('✅ Badge descriptions updated successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
