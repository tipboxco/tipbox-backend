import { PrismaClient, ContentPostType } from '@prisma/client';
import { generateUlid, TEST_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from '../types';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * MacBook Air 13" M3 için post'lar ve news'ler oluştur
 */
export async function seedMacBookAirPostsAndNews(productId: string): Promise<{
  posts: number;
  news: number;
}> {
  console.log('📝 [seed] MacBook Air 13" M3 posts and news');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      group: true,
      brand: true,
    },
  });

  if (!product || !product.brand) {
    throw new Error('Product or brand not found');
  }

  const users = [TEST_USER_ID, ...TRUST_USER_IDS, ...TRUSTER_USER_IDS];
  const postTypes: ContentPostType[] = [
    ContentPostType.EXPERIENCE,
    ContentPostType.COMPARE,
    ContentPostType.TIPS,
    ContentPostType.QUESTION,
  ];

  const postConfigs = [
    // EXPERIENCE posts
    {
      type: ContentPostType.EXPERIENCE,
      title: 'My 6-Month Experience with MacBook Air 13" M3',
      body: 'I\'ve been using the MacBook Air 13" M3 for the past 6 months and I\'m extremely impressed. The performance is outstanding for everyday tasks, and the battery life is exceptional. The lightweight design makes it perfect for travel, and the M3 chip handles everything I throw at it without breaking a sweat.',
    },
    {
      type: ContentPostType.EXPERIENCE,
      title: 'Daily Usage Review: MacBook Air M3 Performance',
      body: 'After using this laptop daily for work and personal projects, I can confidently say it\'s one of the best laptops I\'ve ever owned. The build quality is excellent, the keyboard is comfortable, and the trackpad is incredibly responsive.',
    },
    {
      type: ContentPostType.EXPERIENCE,
      title: 'MacBook Air M3: A Perfect Balance of Power and Portability',
      body: 'The MacBook Air M3 strikes the perfect balance between power and portability. I use it for coding, video editing, and general productivity, and it handles everything smoothly. The fanless design means it\'s completely silent, which is a huge plus.',
    },
    // COMPARE posts
    {
      type: ContentPostType.COMPARE,
      title: 'MacBook Air M3 vs MacBook Pro 14" M4: Which One?',
      body: 'I compared the MacBook Air M3 with the MacBook Pro 14" M4, and here are my findings. The M3 Air is more portable and has better battery life, while the M4 Pro offers more power for intensive tasks. For most users, the Air is the better choice.',
    },
    {
      type: ContentPostType.COMPARE,
      title: 'M3 vs M2: Performance Benchmark Comparison',
      body: 'Benchmark results show the M3 chip is significantly faster than the M2, especially in multi-core performance. The M3 also has better GPU performance, making it great for graphics-intensive tasks.',
    },
    {
      type: ContentPostType.COMPARE,
      title: 'MacBook Air M3 vs Windows Laptops: Real-World Test',
      body: 'Compared to Windows laptops in the same price range, the MacBook Air M3 offers superior build quality, better battery life, and a more polished operating system. The M3 chip outperforms most Intel and AMD processors in this category.',
    },
    // TIPS posts
    {
      type: ContentPostType.TIPS,
      title: '10 Essential Tips for Maximizing MacBook Air M3 Battery Life',
      body: 'To maximize battery life, use Low Power Mode when not doing intensive tasks, close unnecessary apps, and reduce screen brightness. I regularly get 15+ hours of battery life with these settings.',
    },
    {
      type: ContentPostType.TIPS,
      title: 'MacBook Air M3 Optimization Tips for Developers',
      body: 'For developers, I recommend using Rosetta 2 for Intel-based apps, enabling Developer Mode for better performance, and using Activity Monitor to identify resource-heavy processes.',
    },
    {
      type: ContentPostType.TIPS,
      title: 'Best Practices for MacBook Air M3 Thermal Management',
      body: 'The MacBook Air M3 is fanless, so thermal management is important. Avoid blocking the vents, use it on a hard surface, and consider a laptop stand for better airflow during intensive tasks.',
    },
    // QUESTION posts
    {
      type: ContentPostType.QUESTION,
      title: 'Is MacBook Air M3 enough for video editing?',
      body: 'I\'m considering the MacBook Air M3 for video editing. I mainly edit 1080p videos in Final Cut Pro. Will the base model with 8GB RAM be sufficient, or should I upgrade to 16GB?',
    },
    {
      type: ContentPostType.QUESTION,
      title: 'Should I upgrade from M1 to M3 MacBook Air?',
      body: 'I currently have a MacBook Air M1 and I\'m wondering if upgrading to the M3 is worth it. The M1 still works well, but I\'m curious about the performance improvements.',
    },
    {
      type: ContentPostType.QUESTION,
      title: 'MacBook Air M3 RAM: 8GB vs 16GB for programming?',
      body: 'I\'m a software developer and I\'m torn between 8GB and 16GB RAM for the MacBook Air M3. I work with multiple IDEs, Docker containers, and browser tabs. What would you recommend?',
    },
  ];

  let createdPosts = 0;
  const usersForPosts = users.slice(0, 8);

  for (let i = 0; i < postConfigs.length; i++) {
    const config = postConfigs[i];
    const userId = usersForPosts[i % usersForPosts.length];
    const postId = generateUlid();

    await prisma.contentPost.create({
      data: {
        id: postId,
        userId,
        type: config.type,
        title: config.title,
        body: config.body,
        productId: product.id,
        mainCategoryId: product.categoryId || null,
        subCategoryId: product.group?.subCategoryId || null,
        productGroupId: product.groupId || null,
        inventoryRequired: false,
        isBoosted: false,
      },
    });

    createdPosts++;
    console.log(`  ✅ Created ${config.type} post: ${config.title.substring(0, 50)}...`);
  }

  // News articles
  const newsArticles = [
    {
      title: 'MacBook Air M3 Gets Major Software Update with New Features',
      content: `Apple has released a significant software update for the MacBook Air 13" M3, introducing several new features and performance improvements. The update includes enhanced battery optimization, improved thermal management, and new accessibility features.

The update brings macOS Sequoia 15.2 with several MacBook Air-specific enhancements. Users will notice improved battery life, with Apple claiming up to 18 hours of video playback. The thermal management system has been refined to maintain peak performance even during extended use.

New features include:
- Advanced battery health monitoring
- Improved display color accuracy
- Enhanced keyboard backlighting controls
- Better integration with iPhone and iPad
- New productivity shortcuts

Performance improvements are particularly noticeable in multi-core tasks, with benchmark scores showing a 15% improvement in certain workloads. The update is available now through System Settings.`,
      bannerKey: 'news/apple-macbook-update.jpg',
    },
    {
      title: 'MacBook Air M3 Review: The Perfect Laptop for Most Users',
      content: `After extensive testing, we can confidently say the MacBook Air 13" M3 is one of the best laptops available today. It combines exceptional performance, outstanding battery life, and a premium design in a lightweight package.

Performance:
The M3 chip delivers impressive performance across all tasks. Whether you're editing videos, coding, or just browsing the web, the MacBook Air handles everything smoothly. The 8-core CPU and 8-core GPU provide more than enough power for most users.

Battery Life:
One of the standout features is the battery life. We consistently achieved 15-18 hours of use with normal tasks. Even with intensive workloads, the battery lasted well over 10 hours.

Design:
The design is classic Apple - premium materials, excellent build quality, and attention to detail. The keyboard is comfortable for long typing sessions, and the trackpad is the best in the industry.

Verdict:
If you're looking for a laptop that does everything well without breaking the bank, the MacBook Air M3 is an excellent choice. It's perfect for students, professionals, and anyone who values portability and performance.`,
      bannerKey: 'news/macbook-air-review.jpg',
    },
    {
      title: 'Apple Announces New Accessories for MacBook Air M3',
      content: `Apple has unveiled a new line of accessories specifically designed for the MacBook Air M3. The collection includes a new MagSafe charger, a protective case, and a premium laptop stand.

The new MagSafe charger features faster charging speeds and a more compact design. It can charge the MacBook Air M3 from 0 to 50% in just 30 minutes. The protective case is made from premium materials and provides excellent protection while maintaining the laptop's slim profile.

The laptop stand is designed to improve airflow and ergonomics. It features an adjustable height mechanism and is made from aluminum to match the MacBook Air's aesthetic.

All accessories are available now through Apple's website and authorized retailers. The MagSafe charger retails for $49, the protective case for $79, and the laptop stand for $99.`,
      bannerKey: 'news/macbook-accessories.jpg',
    },
    {
      title: 'MacBook Air M3 Performance Benchmarks Revealed',
      content: `Independent testing has revealed impressive benchmark results for the MacBook Air 13" M3. The laptop scored exceptionally well across all performance metrics, often matching or exceeding more expensive competitors.

CPU Performance:
In Geekbench 6, the M3 chip scored 2,850 in single-core and 12,100 in multi-core tests. These scores place it among the top performers in its class, outperforming many Intel and AMD processors.

GPU Performance:
The integrated GPU performed admirably in graphics tests. It handled 4K video editing smoothly and could run many games at playable frame rates. For professional graphics work, it's more than capable.

Battery Performance:
Battery tests showed exceptional results. The MacBook Air M3 lasted 17 hours in our standard battery test, which involves web browsing, video playback, and light productivity tasks.

Thermal Performance:
Despite being fanless, the MacBook Air M3 maintained excellent thermal performance. Even under sustained load, the laptop remained cool and quiet, with no performance throttling observed.

These results confirm that the MacBook Air M3 offers exceptional value for money, delivering performance that rivals much more expensive laptops.`,
      bannerKey: 'news/macbook-benchmarks.jpg',
    },
    {
      title: 'MacBook Air M3: Tips and Tricks for Maximum Productivity',
      content: `Here are some expert tips to get the most out of your MacBook Air 13" M3:

1. Optimize Battery Life:
Enable Low Power Mode when not doing intensive tasks. Close unnecessary apps and reduce screen brightness. Use Activity Monitor to identify apps that drain battery.

2. Maximize Performance:
For best performance, keep at least 20% of your storage free. Use CleanMyMac or similar tools to remove unnecessary files. Enable Developer Mode if you're a developer.

3. Keyboard Shortcuts:
Learn essential keyboard shortcuts like Cmd+Space for Spotlight, Cmd+Tab for app switching, and Cmd+\` for window switching. These shortcuts can significantly improve your workflow.

4. Trackpad Gestures:
Master trackpad gestures like three-finger swipe for Mission Control, pinch to zoom, and two-finger scroll. These gestures make navigation much faster.

5. External Display Setup:
The MacBook Air M3 supports up to two external displays. Use DisplayLink adapters for multiple monitor setups. Adjust display settings for optimal color accuracy.

6. Storage Management:
Use iCloud for file storage to free up local space. Enable Optimize Storage to automatically remove downloaded files when space is needed.

7. Security:
Enable FileVault for disk encryption. Use Touch ID for quick authentication. Keep macOS updated for the latest security patches.

8. Maintenance:
Regularly restart your MacBook to clear system cache. Run First Aid in Disk Utility monthly. Keep your software updated.

Following these tips will help you get the best experience from your MacBook Air M3.`,
      bannerKey: 'news/macbook-tips.jpg',
    },
    {
      title: 'MacBook Air M3 vs Competitors: Comprehensive Comparison',
      content: `We've compared the MacBook Air 13" M3 with its main competitors, and here's what we found:

vs Dell XPS 13:
The MacBook Air M3 offers better battery life (17 hours vs 12 hours), superior build quality, and a more polished operating system. The XPS 13 has a better display and more ports, but the MacBook Air's M3 chip outperforms the Intel processors in the XPS.

vs HP Spectre x360:
The MacBook Air is lighter (2.7 lbs vs 3.0 lbs) and has better battery life. The Spectre offers a 2-in-1 design and more ports, but the MacBook Air's performance and efficiency are superior.

vs Lenovo ThinkPad X1 Carbon:
The ThinkPad has a better keyboard and more business features, but the MacBook Air offers better performance, battery life, and a more modern design. The M3 chip significantly outperforms the Intel processors in the ThinkPad.

vs Microsoft Surface Laptop:
The Surface Laptop has a touchscreen and better port selection, but the MacBook Air offers superior performance, battery life, and build quality. The M3 chip is more efficient and powerful than the Surface's processors.

Overall Winner:
The MacBook Air M3 wins in most categories, particularly in performance, battery life, and overall user experience. It's the best choice for most users who want a premium laptop that does everything well.`,
      bannerKey: 'news/macbook-comparison.jpg',
    },
    {
      title: 'Apple Releases macOS Update Optimized for MacBook Air M3',
      content: `Apple has released macOS 15.3, which includes several optimizations specifically for the MacBook Air M3. The update improves performance, battery life, and introduces new features.

Performance Improvements:
The update includes optimizations that improve CPU and GPU performance by up to 10%. Apps launch faster, and multitasking is smoother. The update also improves memory management, allowing for better performance with multiple apps open.

Battery Life Enhancements:
New battery optimization algorithms extend battery life by up to 2 hours. The system now better manages background processes and reduces unnecessary CPU usage. Low Power Mode has been enhanced to provide even better battery savings.

New Features:
- Enhanced Stage Manager for better window management
- Improved Spotlight search with AI-powered suggestions
- New Control Center widgets
- Better integration with iPhone and iPad
- Improved security features

Bug Fixes:
The update fixes several bugs, including display flickering issues, Wi-Fi connectivity problems, and keyboard backlighting inconsistencies. Users have reported much better stability after the update.

Installation:
The update is available through System Settings > Software Update. It's a 3.5GB download and takes approximately 20 minutes to install. Apple recommends backing up your data before installing.`,
      bannerKey: 'news/macos-update.jpg',
    },
    {
      title: 'MacBook Air M3: Real-World Usage Review After 3 Months',
      content: `After using the MacBook Air 13" M3 for three months, here's my comprehensive review:

Daily Usage:
I use the MacBook Air for work, which includes coding, video editing, and general productivity. The laptop handles everything smoothly, with no lag or performance issues. The battery easily lasts a full workday, and I rarely need to charge it during the day.

Performance:
The M3 chip is incredibly fast. Apps launch instantly, and multitasking is seamless. I regularly have 20+ browser tabs open, along with multiple IDEs and other apps, and the laptop never slows down. Video editing is smooth, even with 4K footage.

Battery Life:
Battery life is exceptional. I consistently get 15-17 hours of use with normal tasks. Even with intensive workloads, the battery lasts 10+ hours. The fast charging is also great - I can charge from 0 to 50% in about 30 minutes.

Build Quality:
The build quality is excellent. The aluminum body feels premium and durable. The keyboard is comfortable for long typing sessions, and the trackpad is the best I've used. The display is bright and color-accurate.

Issues:
The only minor issue I've encountered is that the laptop can get warm during intensive tasks, but it never gets uncomfortably hot. The fanless design means it's completely silent, which is a huge plus.

Verdict:
The MacBook Air M3 is an excellent laptop that offers exceptional performance, battery life, and build quality. It's perfect for most users and represents excellent value for money. I highly recommend it.`,
      bannerKey: 'news/macbook-3month-review.jpg',
    },
    {
      title: 'MacBook Air M3: Best Configuration for Different Use Cases',
      content: `Choosing the right configuration for your MacBook Air M3 depends on your use case. Here's our guide:

For Students:
The base model (8GB RAM, 256GB storage) is perfect for most students. It handles note-taking, research, and light coding without any issues. The battery life ensures it lasts through a full day of classes.

For Professionals:
We recommend 16GB RAM and 512GB storage. This configuration provides enough power for multitasking, running multiple apps, and handling large files. It's ideal for developers, designers, and content creators.

For Power Users:
If you do intensive video editing, 3D rendering, or run virtual machines, consider 24GB RAM and 1TB storage. This configuration provides maximum performance and storage for demanding workloads.

For Casual Users:
The base model is more than sufficient for web browsing, email, and light productivity tasks. You can always use external storage or cloud storage if you need more space.

Storage Considerations:
- 256GB: Fine for light users, but you'll likely need external storage
- 512GB: Good balance for most users
- 1TB: Ideal for professionals who work with large files
- 2TB: Overkill for most users, but great if you work with 4K video

RAM Considerations:
- 8GB: Fine for light tasks, but can be limiting with multiple apps
- 16GB: Sweet spot for most users, handles multitasking well
- 24GB: Only needed for intensive workloads

Our Recommendation:
For most users, the 16GB RAM / 512GB storage configuration offers the best balance of performance and value.`,
      bannerKey: 'news/macbook-configuration.jpg',
    },
    {
      title: 'MacBook Air M3: Future-Proofing and Upgrade Path',
      content: `The MacBook Air 13" M3 is designed to last for years, but here's what you need to know about future-proofing:

Expected Lifespan:
Based on Apple's track record and the M3 chip's performance, the MacBook Air M3 should easily last 5-7 years. The M3 chip is powerful enough to handle future software updates and new applications.

Software Support:
Apple typically provides macOS updates for 5-7 years. The M3 chip is new, so you can expect support until at least 2029-2030. This means you'll receive security updates and new features for years to come.

Performance Over Time:
The M3 chip is powerful enough to handle future software requirements. While newer chips will be faster, the M3 will remain capable for years. The 8GB RAM might become limiting in 3-4 years, so consider 16GB if you plan to keep the laptop long-term.

Upgrade Limitations:
Unlike some Windows laptops, the MacBook Air M3 has no user-upgradeable components. RAM and storage are soldered to the motherboard, so choose your configuration carefully. This is why we recommend 16GB RAM for most users.

Resale Value:
MacBooks hold their value well. After 3-4 years, you can expect to get 50-60% of the original price when selling. This makes the MacBook Air M3 a good investment.

Future-Proofing Tips:
- Choose 16GB RAM if you plan to keep the laptop 4+ years
- Get 512GB+ storage if you work with large files
- Keep macOS updated for best performance
- Use external storage for files you don't need daily
- Consider AppleCare+ for extended warranty

Conclusion:
The MacBook Air M3 is well-built and should serve you well for many years. Choose your configuration based on your long-term needs, not just your current usage.`,
      bannerKey: 'news/macbook-future.jpg',
    },
  ];

  let createdNews = 0;
  const brandId = product.brand.id;

  for (const article of newsArticles) {
    const newsId = randomUUID();
    const bannerUrl = getSeedMediaPath(article.bannerKey as SeedMediaKey, true) || null;

    await prisma.news.create({
      data: {
        id: newsId,
        brandId: brandId,
        title: article.title,
        content: article.content,
        bannerImageUrl: bannerUrl,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      },
    });

    createdNews++;
    console.log(`  ✅ Created news: ${article.title.substring(0, 60)}...`);
  }

  console.log(`\n✅ Posts: ${createdPosts}, News: ${createdNews}`);

  return { posts: createdPosts, news: createdNews };
}
