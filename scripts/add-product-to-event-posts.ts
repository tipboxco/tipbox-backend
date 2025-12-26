import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_ID = process.argv[2] || '00MJMTQ06L00000V3UUWJ91YLG';

async function addProductToEventPosts(): Promise<void> {
  console.log(`📝 Event post'larına product bilgisi ekleniyor: ${EVENT_ID}\n`);

  try {
    // Event'i kontrol et
    const event = await prisma.wishboxEvent.findUnique({
      where: { id: EVENT_ID },
    });

    if (!event) {
      console.error(`❌ Event bulunamadı: ${EVENT_ID}`);
      process.exit(1);
    }

    console.log(`✅ Event bulundu: ${event.title}\n`);

    // Event'e ait post'ları bul (scenario choice'lar üzerinden)
    const scenarios = await prisma.wishboxScenario.findMany({
      where: { eventId: EVENT_ID },
      include: {
        choices: {
          include: {
            user: true,
          },
        },
      },
    });

    const participantUserIds = new Set<string>();
    scenarios.forEach((scenario) => {
      scenario.choices.forEach((choice) => {
        participantUserIds.add(choice.userId);
      });
    });

    if (participantUserIds.size === 0) {
      console.warn('⚠️  Event\'e katılan kullanıcı bulunamadı!');
      return;
    }

    console.log(`👥 ${participantUserIds.size} katılımcı bulundu\n`);

    // Bu kullanıcıların post'larını bul
    const posts = await prisma.contentPost.findMany({
      where: {
        userId: { in: Array.from(participantUserIds) },
        // Sadece productId'si olmayan post'ları güncelle
        productId: null,
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        mainCategoryId: true,
        subCategoryId: true,
        productGroupId: true,
      },
    });

    if (posts.length === 0) {
      console.warn('⚠️  Güncellenecek post bulunamadı!');
      return;
    }

    console.log(`📝 ${posts.length} post bulundu\n`);

    // Varsayılan product'ı bul (Coffee Lovers Survey için kahve makinesi veya genel bir ürün)
    // Önce event title'ına göre uygun bir kategori bul
    let targetProduct = null;
    
    // Event title'ına göre kategori seç
    if (event.title.toLowerCase().includes('coffee') || event.title.toLowerCase().includes('kahve')) {
      // Kahve makinesi kategorisi
      const mainCategory = await prisma.mainCategory.findFirst({
        where: { 
          name: {
            contains: 'Home',
            mode: 'insensitive',
          },
        },
      });
      
      if (mainCategory) {
        const subCategory = await prisma.subCategory.findFirst({
          where: { 
            mainCategoryId: mainCategory.id,
            name: {
              contains: 'Kitchen',
              mode: 'insensitive',
            },
          },
        });
        
        if (subCategory) {
          const productGroup = await prisma.productGroup.findFirst({
            where: { subCategoryId: subCategory.id },
          });
          
          if (productGroup) {
            targetProduct = await prisma.product.findFirst({
              where: { groupId: productGroup.id },
              include: {
                group: {
                  include: {
                    subCategory: {
                      include: {
                        mainCategory: true,
                      },
                    },
                  },
                },
              },
            });
          }
        }
      }
    }

    // Eğer uygun product bulunamadıysa, herhangi bir product kullan
    if (!targetProduct) {
      targetProduct = await prisma.product.findFirst({
        include: {
          group: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
        },
      });
    }

    if (!targetProduct) {
      console.warn('⚠️  Product bulunamadı!');
      return;
    }

    console.log(`✅ Product bulundu: ${targetProduct.name}\n`);

    let updatedCount = 0;

    // Her post'a product bilgisi ekle
    for (const post of posts) {
      try {
        const productGroup = (targetProduct as any).group;
        const subCategory = productGroup?.subCategory;
        const mainCategory = subCategory?.mainCategory;

        await prisma.contentPost.update({
          where: { id: post.id },
          data: {
            productId: targetProduct.id,
            productGroupId: targetProduct.groupId || post.productGroupId,
            subCategoryId: productGroup?.subCategoryId || post.subCategoryId,
            mainCategoryId: mainCategory?.id || post.mainCategoryId,
          },
        });
        console.log(`   ✅ Post güncellendi: ${post.id} -> Product: ${targetProduct.name}`);
        updatedCount++;
      } catch (error: any) {
        console.warn(`   ⚠️  Post ${post.id} güncellenemedi: ${error.message}`);
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Güncellenen post: ${updatedCount}`);

    console.log('\n✨ Event post product ekleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
addProductToEventPosts()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

