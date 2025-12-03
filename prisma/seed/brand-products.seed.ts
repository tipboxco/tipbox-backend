/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { readFileSync } from 'fs';
import path from 'path';
import { prisma, generateUlid, TEST_USER_ID } from './types';
import { getSeedMediaUrl } from './helpers/media.helper';
import { S3Service } from '../../src/infrastructure/s3/s3.service';

export async function seedBrandProducts(): Promise<void> {
  console.log('🏷️ [seed] brand products & experiences & news');

  // Test kullanıcısını bul
  const userIdToUse = (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id || (await prisma.user.findFirst())?.id!;
  if (!userIdToUse) {
    console.warn('⚠️ Test kullanıcısı bulunamadı, brand products seed atlanıyor');
    return;
  }

  // Kategorileri bul
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } });
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } });
  
  if (!techCategory || !evYasamCategory) {
    console.warn('⚠️ Kategoriler bulunamadı, brand products seed atlanıyor');
    return;
  }

  // Sub kategorileri bul veya oluştur
  let techSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: techCategory.id } });
  if (!techSubCategory) {
    techSubCategory = await prisma.subCategory.create({
      data: {
        name: 'Akıllı Telefonlar',
        description: 'iPhone, Android, Samsung, Xiaomi vs.',
        mainCategoryId: techCategory.id,
        imageUrl: getSeedMediaUrl('catalog.phones'),
      },
    });
  }

  let evYasamSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: evYasamCategory.id } });
  if (!evYasamSubCategory) {
    evYasamSubCategory = await prisma.subCategory.create({
      data: {
        name: 'Temizlik Ürünleri',
        description: 'Süpürge, temizlik robotu vb.',
        mainCategoryId: evYasamCategory.id,
        imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      },
    });
  }

  // Brand'ları bul (tüm brand'ları al, sadece belirli brand'ları değil)
  const brands = await prisma.brand.findMany({
    take: 10, // İlk 10 brand'ı al
  });

  if (brands.length === 0) {
    console.warn('⚠️ Brand\'lar bulunamadı, önce explore seed çalıştırılmalı');
    return;
  }

  // Her brand için product'lar ve post'lar oluştur
  for (const brand of brands) {
    console.log(`📦 Brand için product'lar oluşturuluyor: ${brand.name}`);

    // Brand'a göre kategori seç
    const isTechBrand = ['TechVision', 'FitnessTech'].includes(brand.name);
    const isAutoPartsBrand = brand.name === 'AutoParts Pro';
    // AutoParts Pro için de Ev & Yaşam kategorisini kullan (veya ileride otomotiv kategorisi eklenebilir)
    const mainCategory = isTechBrand ? techCategory : evYasamCategory;
    const subCategory = isTechBrand ? techSubCategory : evYasamSubCategory;

    // Product group oluştur veya bul
    let productGroup = await prisma.productGroup.findFirst({
      where: {
        subCategoryId: subCategory.id,
        name: { contains: brand.name },
      },
    });

    if (!productGroup) {
      productGroup = await prisma.productGroup.create({
        data: {
          name: `${brand.name} Ürünleri`,
          description: `${brand.name} markasına ait ürünler`,
          subCategoryId: subCategory.id,
          imageUrl: getSeedMediaUrl('product.laptop.macbook'),
        },
      });
    }

    // Brand'a özel product'lar oluştur
    const productConfigs = getProductConfigsForBrand(brand.name);
    
    for (const productConfig of productConfigs) {
      // Product'ı oluştur veya bul
      let product = await prisma.product.findFirst({
        where: {
          brand: brand.name,
          name: productConfig.name,
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: productConfig.name,
            brand: brand.name,
            description: productConfig.description,
            groupId: productGroup.id,
            imageUrl: getSeedMediaUrl(productConfig.imageKey as any),
          },
        });
      }

      // Inventory oluştur (experiences için gerekli)
      let inventory = await prisma.inventory.findFirst({
        where: {
          userId: userIdToUse,
          productId: product.id,
        },
      });

      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            userId: userIdToUse,
            productId: product.id,
            hasOwned: true,
            experienceSummary: `${product.name} hakkında deneyim paylaşımı`,
          },
        });

        // Inventory media ekle
        await prisma.inventoryMedia.create({
          data: {
            inventoryId: inventory.id,
            mediaUrl: getSeedMediaUrl(productConfig.imageKey as any),
            type: 'IMAGE',
          },
        }).catch(() => {});
      }

      // EXPERIENCES için FREE type post'lar oluştur
      const existingExperiencePosts = await prisma.contentPost.findMany({
        where: {
          productId: product.id,
          type: 'FREE',
        },
      });

      // Her product için en az 5-6 experience post oluştur
      const experienceTemplates = [
        {
          title: `${product.name} ile İlk Günlerim`,
          body: `${product.name} ürününü aldıktan sonraki ilk günlerimde yaşadığım deneyimler. ${productConfig.experienceText} Gerçekten beklediğimden çok daha iyi bir kullanıcı deneyimi sunuyor.`,
        },
        {
          title: `${product.name} - Günlük Kullanım Deneyimi`,
          body: `${product.name} ürününü günlük hayatımda düzenli olarak kullanıyorum. Performansı ve dayanıklılığı açısından gerçekten memnunum. Özellikle ${productConfig.experienceText} özelliği beni çok etkiledi.`,
        },
        {
          title: `${product.name} Detaylı İnceleme`,
          body: `${product.name} ürününü detaylı bir şekilde test ettim. Kullanım kolaylığı, tasarım ve fonksiyonellik açısından çok başarılı. ${productConfig.experienceText} özellikleri ile günlük ihtiyaçlarımı karşılıyor.`,
        },
        {
          title: `${product.name} - Uzun Vadeli Kullanım`,
          body: `${product.name} ürününü birkaç aydır kullanıyorum ve uzun vadeli performansı gerçekten etkileyici. ${productConfig.experienceText} Özellikle dayanıklılığı ve kalitesi konusunda hiçbir sorun yaşamadım.`,
        },
        {
          title: `${product.name} ile Yaşam Kalitesi`,
          body: `${product.name} ürünü hayatımı gerçekten kolaylaştırdı. Kullanımı çok pratik ve sonuçlar beklediğimden çok daha iyi. ${productConfig.experienceText} Özelliklerini kullanarak daha verimli bir günlük rutin oluşturdum.`,
        },
        {
          title: `${product.name} - Profesyonel Bakış Açısı`,
          body: `${product.name} ürününü profesyonel bir bakış açısıyla değerlendirdim. Kalite, performans ve kullanıcı deneyimi açısından gerçekten üst seviye. ${productConfig.experienceText} Özelliği ile işlerimi çok daha hızlı hallettim.`,
        },
      ];

      if (existingExperiencePosts.length < 5) {
        const postsToCreate = 6 - existingExperiencePosts.length;
        for (let i = 0; i < postsToCreate; i++) {
          const template = experienceTemplates[i % experienceTemplates.length];
          const experiencePostId = generateUlid();
          
          await prisma.contentPost.create({
            data: {
              id: experiencePostId,
              userId: userIdToUse,
              type: 'FREE',
              title: template.title,
              body: template.body,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: i === 0,
            },
          });

          // Post tag'leri ekle
          await prisma.contentPostTag.createMany({
            data: [
              { postId: experiencePostId, tag: brand.name },
              { postId: experiencePostId, tag: product.name },
              { postId: experiencePostId, tag: 'Deneyim' },
              { postId: experiencePostId, tag: 'Kullanıcı Deneyimi' },
            ],
            skipDuplicates: true,
          });

          // Like ve favorite ekle (rastgele sayıda)
          if (i % 2 === 0) {
            await prisma.contentLike.create({
              data: { userId: userIdToUse, postId: experiencePostId },
            }).catch(() => {});
          }
          
          if (i % 3 === 0) {
            await prisma.contentFavorite.create({
              data: { userId: userIdToUse, postId: experiencePostId },
            }).catch(() => {});
          }
        }
        console.log(`✅ ${postsToCreate} experience post oluşturuldu: ${product.name}`);
      }

      // NEWS için farklı tip post'lar oluştur
      const existingNewsPosts = await prisma.contentPost.findMany({
        where: {
          productId: product.id,
          type: {
            in: ['TIPS', 'QUESTION', 'COMPARE', 'UPDATE', 'EXPERIENCE'],
          },
        },
      });

      // event.jpg görselini MinIO'ya yükle (10 adet news post için)
      const eventImagePath = path.join(__dirname, '../../tests/assets/WhatsNews/event.jpg');
      let eventImageUrls: string[] = [];
      
      try {
        const s3Service = new S3Service();
        const eventImageBuffer = readFileSync(eventImagePath);
        
        // 10 adet farklı URL için görseli yükle
        for (let i = 0; i < 10; i++) {
          const objectKey = `news/${brand.name.toLowerCase().replace(/\s+/g, '-')}/${product.id}/${Date.now()}-${i}-event.jpg`;
          const uploadedUrl = await s3Service.uploadFile(objectKey, eventImageBuffer, 'image/jpeg');
          // Localhost uyumlu URL oluştur
          const localhostUrl = uploadedUrl.replace('minio:9000', 'localhost:9000');
          eventImageUrls.push(localhostUrl);
        }
        console.log(`✅ ${eventImageUrls.length} adet event.jpg görseli MinIO'ya yüklendi`);
      } catch (error) {
        console.warn('⚠️ event.jpg yüklenemedi, görsel olmadan devam ediliyor:', error);
        // Görsel yüklenemezse boş array ile devam et
      }

      // Her product için en az 10 news post oluştur (çeşitli tipler + event.jpg görselleri)
      if (existingNewsPosts.length < 10) {
        // Mevcut post tiplerini kontrol et
        const existingTypes = existingNewsPosts.map(p => p.type);
        const newsToCreate = 10 - existingNewsPosts.length;
        let createdCount = 0;
        let eventImageIndex = 0;

        // UPDATE post'lar (haberler için uygun)
        const updateTemplates = [
          {
            title: `${product.name} İçin Yeni Özellik Güncellemesi`,
            body: `${product.name} ürünü için yeni özellik güncellemesi yayınlandı! Artık daha fazla fonksiyon mevcut. Kullanıcılar için daha iyi bir deneyim sunuyor.`,
          },
          {
            title: `${brand.name} Yeni Kampanya Duyurusu`,
            body: `${brand.name} markası yeni kampanya duyurusu yaptı! ${product.name} ürünü için sınırlı süre özel fırsatlar mevcut. Kaçırmayın!`,
          },
          {
            title: `${product.name} Hakkında Yeni Bilgiler`,
            body: `${product.name} ürünü hakkında yeni bilgiler paylaşıldı. Detaylar için takip etmeye devam edin. Ürünün özellikleri ve performansı hakkında güncel bilgiler.`,
          },
        ];

        // UPDATE tipi post oluştur (2 adet)
        if (!existingTypes.includes('UPDATE') && createdCount < newsToCreate) {
          for (let i = 0; i < Math.min(2, newsToCreate - createdCount); i++) {
            const template = updateTemplates[i % updateTemplates.length];
            const updatePostId = generateUlid();
            
            await prisma.contentPost.create({
              data: {
                id: updatePostId,
                userId: userIdToUse,
                type: 'UPDATE',
                title: template.title,
                body: template.body,
                productId: product.id,
                mainCategoryId: mainCategory.id,
                subCategoryId: subCategory.id,
                inventoryRequired: true,
                isBoosted: i === 0,
              },
            }).catch(() => {});

            await prisma.contentPostTag.createMany({
              data: [
                { postId: updatePostId, tag: brand.name },
                { postId: updatePostId, tag: product.name },
                { postId: updatePostId, tag: 'Haber' },
                { postId: updatePostId, tag: 'Güncelleme' },
              ],
              skipDuplicates: true,
            });

            // event.jpg görselini inventory media olarak ekle
            if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl: eventImageUrls[eventImageIndex],
                  type: 'IMAGE',
                },
              }).catch(() => {});
              eventImageIndex++;
            }
            createdCount++;
          }
        }

        // EXPERIENCE tipi post oluştur
        if (!existingTypes.includes('EXPERIENCE') && createdCount < newsToCreate) {
          const experiencePostId = generateUlid();
          await prisma.contentPost.create({
            data: {
              id: experiencePostId,
              userId: userIdToUse,
              type: 'EXPERIENCE',
              title: `${product.name} - Detaylı Deneyim Paylaşımı`,
              body: `${product.name} ürünü ile ilgili detaylı bir deneyim paylaşımı. Uzun vadeli kullanım sonrası gözlemlerim ve önerilerim. ${productConfig.experienceText}`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {});

          await prisma.contentPostTag.createMany({
            data: [
              { postId: experiencePostId, tag: brand.name },
              { postId: experiencePostId, tag: product.name },
              { postId: experiencePostId, tag: 'Deneyim' },
              { postId: experiencePostId, tag: 'Haber' },
            ],
            skipDuplicates: true,
          });

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {});
            eventImageIndex++;
          }
          createdCount++;
        }

        // TIPS post
        if (!existingTypes.includes('TIPS') && createdCount < newsToCreate) {
          const tipsPostId = generateUlid();
          await prisma.contentPost.create({
            data: {
              id: tipsPostId,
              userId: userIdToUse,
              type: 'TIPS',
              title: `${product.name} Kullanım İpuçları`,
              body: `${product.name} için faydalı kullanım ipuçları ve öneriler. Bu ürünü en iyi şekilde kullanmak için bu ipuçlarını takip edin.`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {});

          await prisma.postTip.create({
            data: { postId: tipsPostId, tipCategory: 'USAGE', isVerified: true },
          }).catch(() => {});

          await prisma.contentPostTag.createMany({
            data: [
              { postId: tipsPostId, tag: brand.name },
              { postId: tipsPostId, tag: 'İpucu' },
              { postId: tipsPostId, tag: 'Haber' },
            ],
            skipDuplicates: true,
          });

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {});
            eventImageIndex++;
          }
          createdCount++;
        }

        // QUESTION post
        if (!existingTypes.includes('QUESTION') && createdCount < newsToCreate) {
          const questionPostId = generateUlid();
          await prisma.contentPost.create({
            data: {
              id: questionPostId,
              userId: userIdToUse,
              type: 'QUESTION',
              title: `${product.name} Hakkında Soru`,
              body: `${product.name} hakkında merak ettiğim bir şey var. Bu ürünü kullananlar deneyimlerini paylaşabilir mi?`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: false,
              isBoosted: false,
            },
          }).catch(() => {});

          await prisma.postQuestion.create({
            data: {
              postId: questionPostId,
              expectedAnswerFormat: 'SHORT',
              relatedProductId: product.id,
            },
          }).catch(() => {});

          await prisma.contentPostTag.createMany({
            data: [
              { postId: questionPostId, tag: brand.name },
              { postId: questionPostId, tag: 'Soru' },
              { postId: questionPostId, tag: 'Haber' },
            ],
            skipDuplicates: true,
          });

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {});
            eventImageIndex++;
          }
          createdCount++;
        }

        // COMPARE post (eğer başka bir product varsa)
        if (!existingTypes.includes('COMPARE') && createdCount < newsToCreate) {
          const otherProduct = await prisma.product.findFirst({
            where: {
              brand: brand.name,
              id: { not: product.id },
            },
          });

          if (otherProduct) {
            const comparePostId = generateUlid();
            await prisma.contentPost.create({
              data: {
                id: comparePostId,
                userId: userIdToUse,
                type: 'COMPARE',
                title: `${product.name} vs ${otherProduct.name} Karşılaştırması`,
                body: `İki ürünü karşılaştırdım ve sonuçlar şöyle... ${product.name} ve ${otherProduct.name} arasındaki farkları detaylı bir şekilde inceledim.`,
                productId: product.id,
                mainCategoryId: mainCategory.id,
                subCategoryId: subCategory.id,
                inventoryRequired: false,
                isBoosted: true,
              },
            }).catch(() => {});

            const comparison = await prisma.postComparison.create({
              data: {
                postId: comparePostId,
                product1Id: product.id,
                product2Id: otherProduct.id,
                comparisonSummary: `${product.name} ve ${otherProduct.name} karşılaştırması`,
              },
            }).catch(() => null);

            if (comparison) {
              const fiyatMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Fiyat' } });
              const kaliteMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Kalite' } });
              
              if (fiyatMetric) {
                await prisma.postComparisonScore.create({
                  data: {
                    comparisonId: comparison.id,
                    metricId: fiyatMetric.id,
                    scoreProduct1: 8,
                    scoreProduct2: 7,
                    comment: 'Fiyat karşılaştırması',
                  },
                }).catch(() => {});
              }

              if (kaliteMetric) {
                await prisma.postComparisonScore.create({
                  data: {
                    comparisonId: comparison.id,
                    metricId: kaliteMetric.id,
                    scoreProduct1: 9,
                    scoreProduct2: 8,
                    comment: 'Kalite karşılaştırması',
                  },
                }).catch(() => {});
              }
            }

            await prisma.contentPostTag.createMany({
              data: [
                { postId: comparePostId, tag: brand.name },
                { postId: comparePostId, tag: 'Karşılaştırma' },
                { postId: comparePostId, tag: 'Haber' },
              ],
              skipDuplicates: true,
            });

            // event.jpg görselini inventory media olarak ekle
            if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl: eventImageUrls[eventImageIndex],
                  type: 'IMAGE',
                },
              }).catch(() => {});
              eventImageIndex++;
            }
            createdCount++;
          }
        }

        // Kalan sayı için ek UPDATE post'lar (10 adet toplam için)
        while (createdCount < newsToCreate) {
          const template = updateTemplates[createdCount % updateTemplates.length];
          const updatePostId = generateUlid();
          
          await prisma.contentPost.create({
            data: {
              id: updatePostId,
              userId: userIdToUse,
              type: 'UPDATE',
              title: template.title,
              body: template.body,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {});

          await prisma.contentPostTag.createMany({
            data: [
              { postId: updatePostId, tag: brand.name },
              { postId: updatePostId, tag: product.name },
              { postId: updatePostId, tag: 'Haber' },
              { postId: updatePostId, tag: 'Güncelleme' },
            ],
            skipDuplicates: true,
          });

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {});
            eventImageIndex++;
          }
          createdCount++;
        }

        if (createdCount > 0) {
          console.log(`✅ ${createdCount} news post oluşturuldu: ${product.name}`);
        }
      }
    }
  }

  console.log('🎉 Brand products seeding completed');
}

function getProductConfigsForBrand(brandName: string): Array<{
  name: string;
  description: string;
  imageKey: string;
  experienceText: string;
}> {
  const configs: Record<string, Array<{
    name: string;
    description: string;
    imageKey: string;
    experienceText: string;
  }>> = {
    'TechVision': [
      {
        name: 'TechVision Smart Watch Pro',
        description: 'Gelişmiş özelliklere sahip akıllı saat',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Günlük kullanımda çok pratik, sağlık takibi özellikleri harika.',
      },
      {
        name: 'TechVision Wireless Earbuds X1',
        description: 'Yüksek kaliteli kablosuz kulaklık',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Ses kalitesi mükemmel, pil ömrü de çok iyi.',
      },
    ],
    'SmartHome Pro': [
      {
        name: 'SmartHome Pro Smart Light System',
        description: 'Akıllı ev aydınlatma sistemi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Ev otomasyonu için mükemmel bir çözüm, uygulama kullanımı çok kolay.',
      },
      {
        name: 'SmartHome Pro Thermostat',
        description: 'Akıllı termostat sistemi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Enerji tasarrufu sağlıyor ve kullanımı çok basit.',
      },
    ],
    'CoffeeDelight': [
      {
        name: 'CoffeeDelight Espresso Machine',
        description: 'Profesyonel espresso makinesi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Kahve kalitesi harika, barista kalitesinde espresso yapabiliyorum.',
      },
      {
        name: 'CoffeeDelight Grinder Pro',
        description: 'Profesyonel kahve öğütücü',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Öğütme ayarları çok hassas, tutarlı sonuçlar alıyorum.',
      },
    ],
    'FitnessTech': [
      {
        name: 'FitnessTech Heart Rate Monitor',
        description: 'Gelişmiş kalp atışı monitörü',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Antrenman sırasında çok doğru veriler veriyor, dayanıklılığı da iyi.',
      },
      {
        name: 'FitnessTech Dumbbells Set',
        description: 'Akıllı ağırlık seti',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Evde antrenman için mükemmel, uygulama entegrasyonu harika.',
      },
    ],
    'StyleHub': [
      {
        name: 'StyleHub Designer Lamp',
        description: 'Modern tasarım masa lambası',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Tasarımı çok şık, ev dekorasyonuna mükemmel uyuyor.',
      },
      {
        name: 'StyleHub Modern Chair',
        description: 'Ergonomik ofis koltuğu',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Uzun süre otururken çok rahat, sırt desteği mükemmel.',
      },
    ],
    'AutoParts Pro': [
      {
        name: 'AutoParts Pro Engine Oil',
        description: 'Yüksek kaliteli motor yağı - motor performansını artırıyor, uzun ömürlü kullanım sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motor performansını artırıyor, uzun ömürlü kullanım sağlıyor.',
      },
      {
        name: 'AutoParts Pro Air Filter',
        description: 'Hava filtresi - motor hava kalitesini iyileştiriyor, filtreleme performansı mükemmel',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motor hava kalitesini iyileştiriyor, filtreleme performansı mükemmel.',
      },
      {
        name: 'AutoParts Pro Brake Pads',
        description: 'Fren balata seti - fren performansı çok iyi, güvenli sürüş sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Fren performansı çok iyi, güvenli sürüş sağlıyor.',
      },
      {
        name: 'AutoParts Pro Car Battery',
        description: 'Araba aküsü - güvenilir ve uzun ömürlü, araç için mükemmel bir akü',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Güvenilir ve uzun ömürlü, araç için mükemmel bir akü.',
      },
      {
        name: 'AutoParts Pro Spark Plugs',
        description: 'Buji seti - motorun daha verimli çalışmasını sağlıyor, yakıt tasarrufu sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motorun daha verimli çalışmasını sağlıyor, yakıt tasarrufu sağlıyor.',
      },
      {
        name: 'AutoParts Pro Wiper Blades',
        description: 'Silecek lastiği - yağmur ve kar koşullarında mükemmel görüş sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Yağmur ve kar koşullarında mükemmel görüş sağlıyor, silecek performansı çok iyi.',
      },
      {
        name: 'AutoParts Pro Tire Pressure Gauge',
        description: 'Lastik basınç ölçer - doğru lastik basıncı ile güvenli sürüş',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Doğru lastik basıncı ile güvenli sürüş sağlıyor, kullanımı çok kolay.',
      },
      {
        name: 'AutoParts Pro Jump Starter',
        description: 'Araba çalıştırıcı - acil durumlarda araç için hayat kurtarıcı',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Acil durumlarda araç için hayat kurtarıcı, güçlü ve güvenilir.',
      },
      {
        name: 'AutoParts Pro Car Cover',
        description: 'Araba örtüsü - aracınızı güneş, yağmur ve tozdan korur',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Aracınızı güneş, yağmur ve tozdan korur, dayanıklı malzeme kullanılmış.',
      },
      {
        name: 'AutoParts Pro Floor Mats',
        description: 'Araba paspası - araç içini temiz tutar, dayanıklı ve kolay temizlenir',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Araç içini temiz tutar, dayanıklı ve kolay temizlenir, mükemmel fit.',
      },
    ],
  };

  return configs[brandName] || [];
}

if (require.main === module) {
  seedBrandProducts()
    .catch((e) => {
      console.error('❌ Brand products seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

