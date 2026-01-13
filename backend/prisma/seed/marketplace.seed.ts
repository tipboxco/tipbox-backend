import { prisma } from './types';

export async function seedMarketplace(): Promise<void> {
  console.log('🏪 [seed] marketplace (minimal)');
  // Minimal placeholder to avoid heavy duplication. Extend as needed.
  const anyUser = await prisma.user.findFirst();
  if (!anyUser) return;
  await prisma.marketplaceBanner.create({
    data: {
      title: 'Yeni Sezon NFT Koleksiyonu',
      description: 'Sınırlı sayıda özel avatar ve badge NFT\'leri şimdi satışta!',
      imageUrl: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=800',
      linkUrl: '/marketplace/listings?type=BADGE',
      isActive: true,
      displayOrder: 1,
    },
  }).catch(() => {});
  console.log('🎉 Marketplace seeding completed');
}

if (require.main === module) {
  seedMarketplace()
    .catch((e) => {
      console.error('❌ Marketplace seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}



