import { PrismaClient } from '@prisma/client';
import { seedAppleTrendsTest } from './apple-trends-test.seed';

const prisma = new PrismaClient();

async function main() {
  // Apple brand'ini bul
  const appleBrand = await prisma.brand.findFirst({
    where: { name: 'Apple' },
    select: { id: true },
  });

  if (!appleBrand) {
    console.error('❌ Apple brand bulunamadı. Önce apple-brand seed çalıştırın.');
    process.exit(1);
  }

  console.log(`✅ Apple brand bulundu: ${appleBrand.id}\n`);

  // Test seed'i çalıştır
  await seedAppleTrendsTest(appleBrand.id);

  await prisma.$disconnect();
}

main().catch(console.error);
