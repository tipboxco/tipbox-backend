import { prisma, generateUlid, TRUST_USER_IDS } from '../types';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';

interface PostConfig {
  type: 'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE';
  title: string;
  body: string;
  productName?: string;
  tags?: string[];
  postQuestion?: {
    expectedAnswerFormat: 'SHORT' | 'LONG' | 'POLL' | 'CHOICE';
  };
  postTips?: {
    category: 'USAGE' | 'PURCHASE' | 'CARE';
  };
  postCompare?: {
    product1Name: string;
    product2Name: string;
  };
}

/**
 * Apple posts oluştur - 5 farklı kullanıcı tarafından farklı tip post'lar
 */
export async function seedApplePosts(brandId: string): Promise<{
  posts: Array<{ id: string; type: string; userId: string; title: string }>;
}> {
  console.log('📝 [seed] Apple posts');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Apple products'ları bul
  const appleProducts = await prisma.product.findMany({
    where: {
      brandId: appleBrand.externalId, // Product.brandId Brand.externalId'ye referans veriyor
    },
    take: 20, // İlk 20 product'ı al
  });

  if (appleProducts.length === 0) {
    throw new Error('Apple products not found. Please run apple-products seed first.');
  }

  // Main category ve sub category bul
  const electronicsCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Electronics' },
  });

  if (!electronicsCategory) {
    throw new Error('Electronics main category not found.');
  }

  const phonesSubCategory = await prisma.subCategory.findFirst({
    where: {
      name: 'Phones',
      mainCategoryId: electronicsCategory.id,
    },
  });

  // 5 farklı kullanıcı seç (TRUST_USER_IDS'den)
  const userIds = TRUST_USER_IDS.slice(0, 5);

  // Her kullanıcı için farklı tip post'lar oluştur
  const postConfigs: Array<{ userId: string; posts: PostConfig[] }> = [
    {
      userId: userIds[0],
      posts: [
        {
          type: 'QUESTION',
          title: 'Is iPhone 17 Pro worth the upgrade from iPhone 15?',
          body: 'I currently have an iPhone 15 and I\'m considering upgrading to the iPhone 17 Pro. The new titanium design and ProRAW features look interesting, but I want to know if the performance improvements and camera upgrades justify the cost. Has anyone made a similar upgrade? What are the most noticeable differences?',
          productName: 'iPhone 17 Pro',
          tags: ['Question', 'Upgrade', 'iPhone'],
          postQuestion: {
            expectedAnswerFormat: 'LONG',
          },
        },
        {
          type: 'TIPS',
          title: '5 Essential Tips for Maximizing Your MacBook Battery Life',
          body: 'After using my MacBook Pro M4 for several months, I\'ve discovered some great tips to extend battery life:\n\n1. Enable Low Power Mode when not doing intensive tasks\n2. Close unnecessary background apps\n3. Adjust screen brightness to 50-60%\n4. Use Safari instead of Chrome for better efficiency\n5. Keep macOS updated for battery optimizations\n\nThese simple changes have increased my battery life by almost 30%!',
          productName: 'MacBook Pro 16" M4',
          tags: ['Tips', 'Battery', 'MacBook'],
          postTips: {
            category: 'USAGE',
          },
        },
      ],
    },
    {
      userId: userIds[1],
      posts: [
        {
          type: 'EXPERIENCE',
          title: 'My First Month with iPad Pro 12.9" M4 - A Game Changer',
          body: 'I\'ve been using the iPad Pro 12.9" M4 for a month now, and it has completely transformed how I work. The M4 chip is incredibly powerful - I can edit 4K videos, run multiple design apps simultaneously, and the battery still lasts all day. The Liquid Retina XDR display is stunning for photo editing. The only downside is the price, but if you\'re a creative professional, it\'s absolutely worth it.',
          productName: 'iPad Pro 12.9" M4',
          tags: ['Experience', 'iPad', 'Review'],
        },
        {
          type: 'COMPARE',
          title: 'Apple Watch Series 11 vs Ultra 3: Which Should You Choose?',
          body: 'I\'ve tested both watches extensively. The Series 11 is perfect for daily use with excellent health tracking and a sleek design. The Ultra 3 is built for extreme conditions with better battery life and durability. If you\'re an athlete or outdoor enthusiast, go Ultra. For everyday fitness and style, Series 11 is the better choice.',
          productName: 'Apple Watch Series 11',
          tags: ['Compare', 'Watch', 'Review'],
          postCompare: {
            product1Name: 'Apple Watch Series 11',
            product2Name: 'Apple Watch Ultra 3',
          },
        },
      ],
    },
    {
      userId: userIds[2],
      posts: [
        {
          type: 'UPDATE',
          title: 'iOS 18.2 Update: New Features and Performance Improvements',
          body: 'Just updated my iPhone 17 to iOS 18.2 and I\'m impressed with the improvements. The new AI features are helpful, battery life seems better, and the camera processing is noticeably faster. The update process was smooth and took about 15 minutes. Highly recommend updating if you haven\'t already.',
          productName: 'iPhone 17',
          tags: ['Update', 'iOS', 'Software'],
        },
        {
          type: 'FREE',
          title: 'Why I Switched from Android to iPhone After 10 Years',
          body: 'After using Android phones for over a decade, I finally made the switch to iPhone 17. The ecosystem integration is seamless - everything just works together. The build quality is exceptional, and the camera quality is outstanding. The only thing I miss is the customization options, but the reliability and user experience make up for it.',
          productName: 'iPhone 17',
          tags: ['Review', 'Switch', 'iPhone'],
        },
      ],
    },
    {
      userId: userIds[3],
      posts: [
        {
          type: 'TIPS',
          title: 'How to Get the Most Out of Your AirPods Pro 3',
          body: 'Here are some pro tips for AirPods Pro 3 users:\n\n1. Customize your noise cancellation in Settings\n2. Use Spatial Audio for immersive music and movies\n3. Enable Conversation Awareness for better transparency\n4. Clean the ear tips regularly for best sound quality\n5. Use Find My to locate lost AirPods\n\nThese features make the AirPods Pro 3 the best wireless earbuds I\'ve ever used!',
          productName: 'AirPods Pro 3',
          tags: ['Tips', 'AirPods', 'Audio'],
          postTips: {
            category: 'USAGE',
          },
        },
        {
          type: 'QUESTION',
          title: 'What\'s the best MacBook for a software developer?',
          body: 'I\'m a software developer looking to buy a new MacBook. I work with multiple IDEs, Docker containers, and need to run local servers. Should I go with the MacBook Air 15" M3 or MacBook Pro 14" M4? What are your experiences with development workloads?',
          productName: 'MacBook Pro 14" M4',
          tags: ['Question', 'Development', 'MacBook'],
          postQuestion: {
            expectedAnswerFormat: 'LONG',
          },
        },
      ],
    },
    {
      userId: userIds[4],
      posts: [
        {
          type: 'EXPERIENCE',
          title: 'Apple Watch Ultra 3: Perfect for My Active Lifestyle',
          body: 'As someone who hikes, swims, and runs regularly, the Apple Watch Ultra 3 has been perfect. The battery lasts 3 days with heavy use, the action button is incredibly useful, and the durability is impressive. I\'ve taken it on multiple hiking trips and it\'s held up perfectly. The GPS accuracy is spot-on, and the health metrics are comprehensive.',
          productName: 'Apple Watch Ultra 3',
          tags: ['Experience', 'Fitness', 'Watch'],
        },
        {
          type: 'COMPARE',
          title: 'iPad Air 13" M2 vs iPad Pro 11" M4: Which iPad is Right for You?',
          body: 'Both are excellent tablets, but serve different needs. The iPad Pro 11" M4 has the more powerful chip, better display (ProMotion), and Thunderbolt port. The iPad Air 13" M2 offers more screen real estate at a lower price. For most users, the Air is the better value. For professionals who need maximum performance, the Pro is worth the extra cost.',
          productName: 'iPad Air 13" M2',
          tags: ['Compare', 'iPad', 'Review'],
          postCompare: {
            product1Name: 'iPad Air 13" M2',
            product2Name: 'iPad Pro 11" M4',
          },
        },
      ],
    },
  ];

  const createdPosts: Array<{ id: string; type: string; userId: string; title: string }> = [];

  // Her kullanıcı için post'ları oluştur
  for (const userConfig of postConfigs) {
    const user = await prisma.user.findUnique({
      where: { id: userConfig.userId },
    });

    if (!user) {
      console.warn(`⚠️ User not found: ${userConfig.userId}, skipping posts`);
      continue;
    }

    for (const postConfig of userConfig.posts) {
      // Product'ı bul
      let product = postConfig.productName
        ? appleProducts.find((p) => p.name === postConfig.productName)
        : appleProducts[Math.floor(Math.random() * appleProducts.length)];

      if (!product) {
        product = appleProducts[0]; // Fallback
      }

      // Product group'u bul
      const productGroup = product.groupId
        ? await prisma.productGroup.findUnique({
            where: { id: product.groupId },
            include: { subCategory: true },
          })
        : null;

      const postId = generateUlid();

      // Post oluştur
      await prisma.contentPost.create({
        data: {
          id: postId,
          userId: userConfig.userId,
          type: postConfig.type,
          title: postConfig.title,
          body: postConfig.body,
          productId: product.id,
          productGroupId: product.groupId || null,
          mainCategoryId: electronicsCategory.id,
          subCategoryId: productGroup?.subCategoryId || phonesSubCategory?.id || null,
          inventoryRequired: postConfig.type === 'EXPERIENCE' || postConfig.type === 'FREE',
          isBoosted: false,
        },
      });

      // Post tags ekle
      if (postConfig.tags && postConfig.tags.length > 0) {
        await prisma.contentPostTag.createMany({
          data: postConfig.tags.map((tag) => ({
            postId,
            tag,
          })),
          skipDuplicates: true,
        });
      }

      // Post type'a özel tablolar
      if (postConfig.type === 'QUESTION' && postConfig.postQuestion) {
        await prisma.postQuestion.create({
          data: {
            postId,
            expectedAnswerFormat: postConfig.postQuestion.expectedAnswerFormat,
            relatedProductId: product.id,
          },
        });
      }

      if (postConfig.type === 'TIPS' && postConfig.postTips) {
        await prisma.postTip.create({
          data: {
            postId,
            tipCategory: postConfig.postTips.category,
            isVerified: false,
          },
        }).catch((err) => {
          console.warn(`⚠️ PostTip oluşturulamadı: ${err.message}`);
        });
      }

      if (postConfig.type === 'COMPARE' && postConfig.postCompare) {
        const product1 = appleProducts.find((p) => p.name === postConfig.postCompare!.product1Name);
        const product2 = appleProducts.find((p) => p.name === postConfig.postCompare!.product2Name);

        if (product1 && product2) {
          await prisma.postComparison.create({
            data: {
              postId,
              product1Id: product1.id,
              product2Id: product2.id,
            },
          }).catch((err) => {
            console.warn(`⚠️ PostComparison oluşturulamadı: ${err.message}`);
          });
        }
      }

      createdPosts.push({
        id: postId,
        type: postConfig.type,
        userId: userConfig.userId,
        title: postConfig.title,
      });

      console.log(`  ✅ ${postConfig.type} post oluşturuldu: ${postConfig.title.substring(0, 50)}...`);
    }
  }

  console.log(`\n✅ Toplam ${createdPosts.length} post oluşturuldu`);

  return {
    posts: createdPosts,
  };
}
