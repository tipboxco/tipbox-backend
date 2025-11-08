import { prisma, generateUlid, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS } from './types';

export async function seedExplore(): Promise<void> {
  console.log('🔍 [seed] explore (full)');
  // Marketplace banners
  await Promise.all([
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Sezon NFT Koleksiyonu',
        description: "Sınırlı sayıda özel avatar ve badge NFT'leri şimdi satışta!",
        imageUrl: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=800',
        linkUrl: '/marketplace/listings?type=BADGE',
        isActive: true,
        displayOrder: 1,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Epic Rarity İndirimi',
        description: "%30 indirimli EPIC rarity NFT'lere göz at",
        imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
        linkUrl: '/marketplace/listings?rarity=EPIC',
        isActive: true,
        displayOrder: 2,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Markalar Platformda',
        description: "Ünlü markalar TipBox'a katıldı! Hemen keşfet.",
        imageUrl: 'https://images.unsplash.com/photo-1556742400-b5a9d4555f7c?w=800',
        linkUrl: '/explore/brands/new',
        isActive: true,
        displayOrder: 3,
      },
    }),
  ]).catch(() => {});

  // Brands (subset matching original names)
  await Promise.all(
    [
      { name: 'TechVision', description: 'Yenilikçi teknoloji ürünleri ve çözümleri sunan global marka', category: 'Technology' },
      { name: 'SmartHome Pro', description: 'Akıllı ev sistemleri ve IoT cihazları konusunda uzman', category: 'Home & Living' },
      { name: 'CoffeeDelight', description: 'Premium kahve makineleri ve barista ekipmanları', category: 'Kitchen' },
      { name: 'FitnessTech', description: 'Akıllı spor ekipmanları ve sağlık takip cihazları', category: 'Health & Fitness' },
      { name: 'StyleHub', description: 'Modern ve şık yaşam ürünleri markası', category: 'Fashion' },
    ].map((b) =>
      prisma.brand.create({
        data: { ...b, logoUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200' },
      }).catch(() => null)
    )
  );

  // Wishbox events
  const today = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(new Date().setMonth(today.getMonth() + 1));
  const events = await Promise.all([
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Yılbaşı Mega Ödül Anketi',
        description: 'Yılın en iyi ürünlerini belirle, büyük ödüller kazan! 1000 TIPS havuzu seni bekliyor.',
        startDate: today,
        endDate: nextMonth,
        status: 'PUBLISHED',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Teknoloji Trendleri 2024',
        description: 
          "2024'ün en çok beklenen teknoloji ürünlerini seçiyoruz. Senin tercihin ne?",
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Kahve Tutkunlarının Anketi',
        description:
          'En iyi kahve makinesi hangisi? Kahve severlerin tercihleri bu etkinlikte belirleniyor.',
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
      },
    }),
  ]).catch(() => [] as any);

  if (events && events.length >= 3) {
    await Promise.all([
      prisma.wishboxScenario.create({
        data: { eventId: events[0].id, title: 'Yılın En İyi Telefonu', description: 'Hangi telefon 2024\'ün şampiyonu olmalı?', orderIndex: 1 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[0].id, title: "Yılın En İyi Laptop'u", description: 'En iyi performansı hangi laptop verdi?', orderIndex: 2 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[1].id, title: 'En Beklenen Akıllı Saat', description: '2024\'te hangi akıllı saati almayı düşünüyorsun?', orderIndex: 1 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[2].id, title: 'Tam Otomatik vs Manuel', description: 'Tam otomatik mı, manuel kahve makinesi mi?', orderIndex: 1 },
      }),
    ]).catch(() => {});

    const allUserIds = [
      (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id,
      (await prisma.user.findUnique({ where: { id: TARGET_USER_ID } }))?.id,
      ...TRUST_USER_IDS,
    ].filter(Boolean) as string[];

    await Promise.all(
      events.flatMap((event) =>
        allUserIds.map((userId, index) =>
          prisma.wishboxStats.create({
            data: {
              userId,
              eventId: event.id,
              totalParticipated: Math.floor(Math.random() * 5) + 1,
              totalComments: Math.floor(Math.random() * 10),
              helpfulVotesReceived: Math.floor(Math.random() * 20),
            },
          }).catch(() => null)
        )
      )
    );
  }
}


