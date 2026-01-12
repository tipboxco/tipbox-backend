import { prisma } from './types';

/**
 * Experience Taxonomy - Experience post'ları için kullanılan taxonomy verileri
 * Duration, Location, Purpose seçeneklerini oluşturur
 */
export async function seedTaxonomy(): Promise<void> {
  console.log('📋 [seed] Experience Taxonomy\n');
  
  console.log('⏱️  [seed] experience durations');
  const experienceDurationConfigs = [
    { name: 'Less than 1 month', isActive: true },
    { name: '1-3 months', isActive: true },
    { name: '3-6 months', isActive: true },
    { name: '6-12 months', isActive: true },
    { name: 'More than 1 year', isActive: true },
  ];

  await Promise.all(
    experienceDurationConfigs.map(async (config) => {
      const existing = await (prisma as any).experienceDuration.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experienceDuration.create({ data: config });
    })
  );

  console.log('📍 [seed] experience locations');
  const experienceLocationConfigs = [
    { name: 'Home', isActive: true },
    { name: 'Office', isActive: true },
    { name: 'Outdoor', isActive: true },
    { name: 'Other', isActive: true },
  ];

  await Promise.all(
    experienceLocationConfigs.map(async (config) => {
      const existing = await (prisma as any).experienceLocation.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experienceLocation.create({ data: config });
    })
  );

  console.log('🎯 [seed] experience purposes');
  const experiencePurposeConfigs = [
    { name: 'Personal use', isActive: true },
    { name: 'Professional use', isActive: true },
    { name: 'Gift', isActive: true },
    { name: 'Other', isActive: true },
  ];

  await Promise.all(
    experiencePurposeConfigs.map(async (config) => {
      const existing = await (prisma as any).experiencePurpose.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experiencePurpose.create({ data: config });
    })
  );

  console.log('✅ Experience Taxonomy seeding completed\n');
}

if (require.main === module) {
  seedTaxonomy()
    .catch((e) => {
      console.error('❌ Experience Taxonomy seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


