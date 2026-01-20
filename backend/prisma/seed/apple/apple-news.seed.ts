import { prisma } from '../types';
import { randomUUID } from 'crypto';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';

interface NewsConfig {
  title: string;
  content: string;
  source: string;
  author?: string;
  tags: string[];
  bannerImageKey?: SeedMediaKey;
}

/**
 * Apple news oluştur - 10 adet haber (16:9 banner, detaylı content)
 */
export async function seedAppleNews(brandId: string): Promise<{
  news: Array<{ id: string; title: string }>;
}> {
  console.log('📰 [seed] Apple news');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // News configs - 10 farklı Apple haber
  const newsConfigs: NewsConfig[] = [
    {
      title: 'Apple Announces New Apple Watch Series 11 with Advanced Health Features',
      content: `Apple has unveiled the Apple Watch Series 11, featuring groundbreaking health monitoring capabilities. The new watch includes enhanced heart rate tracking, improved sleep analysis, and a new blood oxygen sensor that provides more accurate readings.

The Series 11 also introduces a larger, brighter display and extended battery life that can last up to 36 hours on a single charge. The watch runs on watchOS 11, which brings new workout modes and improved fitness tracking algorithms.

"We're excited to bring these advanced health features to our users," said Apple's CEO. "The Apple Watch Series 11 represents our commitment to helping people live healthier lives through technology."

The device is available in multiple finishes including aluminum, stainless steel, and titanium. Pricing starts at $399 for the base model.`,
      source: 'tipbox',
      author: 'Apple Editorial Team',
      tags: ['Apple Watch', 'Health', 'Technology', 'Wearables'],
      bannerImageKey: 'product.watch.applewatch' as SeedMediaKey,
    },
    {
      title: 'M4 vs M3 Processors: Performance Comparison and Real-World Benchmarks',
      content: `Apple's latest M4 chip has been making waves in the tech community, and we've put it through comprehensive testing against its predecessor, the M3. Here's what we found:

**Performance Improvements:**
The M4 chip shows a 20-30% improvement in CPU performance and up to 40% better GPU performance compared to the M3. In real-world applications, this translates to faster video rendering, smoother multitasking, and better gaming performance.

**Battery Efficiency:**
Despite the performance boost, the M4 maintains similar battery life to the M3, thanks to improved power efficiency. Our tests showed that the M4 MacBook Pro can handle intensive workloads for up to 18 hours on a single charge.

**AI Capabilities:**
The M4 includes an enhanced Neural Engine with 16 cores, providing significant improvements in machine learning tasks. This makes it ideal for developers working with AI models and creative professionals using AI-powered tools.

**Verdict:**
If you're using an M2 or older Mac, the M4 is a significant upgrade. For M3 users, the improvements are noticeable but may not justify an immediate upgrade unless you're working with demanding applications.`,
      source: 'tipbox',
      author: 'Tech Review Team',
      tags: ['M4 Chip', 'M3 Chip', 'Performance', 'MacBook', 'Benchmarks'],
      bannerImageKey: 'product.laptop.macbook' as SeedMediaKey,
    },
    {
      title: 'iPhone 17 Pro Camera System: Revolutionary Photography Features',
      content: `The iPhone 17 Pro introduces the most advanced camera system ever in an iPhone. The new ProRAW format allows photographers to capture images with unprecedented detail and flexibility.

**Key Features:**
- 48MP main camera with improved low-light performance
- Enhanced telephoto lens with 5x optical zoom
- New Action Button for quick camera access
- Improved computational photography algorithms

The camera system now supports ProRes video recording at 4K 60fps, making it a powerful tool for content creators. The new Photographic Styles feature allows users to customize the look of their photos in real-time.

Early reviews praise the camera's ability to capture stunning images in challenging lighting conditions, with many photographers calling it the best smartphone camera available.`,
      source: 'tipbox',
      author: 'Photography Team',
      tags: ['iPhone 17 Pro', 'Camera', 'Photography', 'Technology'],
      bannerImageKey: 'product.apple.iphone17pro' as SeedMediaKey,
    },
    {
      title: 'iPad Pro 12.9" M4: The Ultimate Tablet for Creative Professionals',
      content: `Apple's latest iPad Pro with the M4 chip is being hailed as the most powerful tablet ever created. With performance that rivals many laptops, it's become the go-to device for creative professionals.

**Display Excellence:**
The 12.9-inch Liquid Retina XDR display offers stunning color accuracy and brightness, perfect for photo and video editing. The ProMotion technology provides buttery-smooth 120Hz refresh rates.

**Performance:**
The M4 chip enables desktop-class performance in a tablet form factor. Video editors can work with 4K footage smoothly, and graphic designers can run complex design software without lag.

**Apple Pencil Integration:**
The new Apple Pencil Pro works seamlessly with the iPad Pro, offering pressure sensitivity and tilt detection that rivals professional drawing tablets.

Whether you're a digital artist, video editor, or designer, the iPad Pro 12.9" M4 offers the power and portability you need.`,
      source: 'tipbox',
      author: 'Creative Team',
      tags: ['iPad Pro', 'M4', 'Creative', 'Tablet', 'Design'],
      bannerImageKey: 'product.tablet.ipad' as SeedMediaKey,
    },
    {
      title: 'AirPods Pro 3: Next-Generation Audio Experience',
      content: `Apple has released the AirPods Pro 3, featuring the new H2 chip and improved active noise cancellation. The earbuds offer an even more immersive audio experience with spatial audio support.

**Audio Quality:**
The new drivers deliver richer bass and clearer highs, making music sound more lifelike. The adaptive EQ automatically adjusts to your ear shape for optimal sound.

**Noise Cancellation:**
The improved active noise cancellation can reduce ambient noise by up to 2x compared to the previous generation. This makes them perfect for travel, commuting, or focusing in noisy environments.

**Battery Life:**
With up to 6 hours of listening time and 30 hours total with the charging case, the AirPods Pro 3 offer excellent battery life. The case now supports MagSafe and wireless charging.

The AirPods Pro 3 are available now for $249 and come in a new USB-C charging case.`,
      source: 'tipbox',
      author: 'Audio Team',
      tags: ['AirPods Pro', 'Audio', 'Wireless', 'Technology'],
      bannerImageKey: 'product.apple.airpodspro3' as SeedMediaKey,
    },
    {
      title: 'macOS Sequoia: New Features and Improvements',
      content: `Apple's latest macOS Sequoia brings exciting new features to Mac users. The update focuses on productivity, security, and seamless integration with other Apple devices.

**Key Features:**
- Enhanced Continuity features for better device integration
- Improved Safari with new privacy tools
- New productivity apps and widgets
- Better performance and battery optimization

**Security Enhancements:**
macOS Sequoia includes advanced security features to protect user data. The new Lockdown Mode provides additional protection for users who may be targeted by sophisticated cyberattacks.

**Compatibility:**
The update is available for Macs from 2019 and later. Users can upgrade through System Settings or the Mac App Store.

Early adopters report improved system stability and faster app launch times. The update is recommended for all compatible Macs.`,
      source: 'tipbox',
      author: 'Software Team',
      tags: ['macOS', 'Software', 'Update', 'MacBook'],
    },
    {
      title: 'Apple Silicon: The Future of Computing',
      content: `Apple's transition to custom silicon has revolutionized the computing industry. The M-series chips have set new standards for performance and efficiency.

**The Journey:**
Starting with the M1 in 2020, Apple has consistently improved its chip technology. The M4 represents the latest evolution, offering desktop-class performance in portable devices.

**Impact on Industry:**
Competitors have been forced to innovate, leading to better processors across the industry. The focus on efficiency has also pushed the industry toward more sustainable computing.

**What's Next:**
Rumors suggest Apple is working on even more powerful chips for professional workstations. The future of Apple Silicon looks bright, with potential applications in servers and data centers.

The success of Apple Silicon demonstrates the value of vertical integration and custom chip design.`,
      source: 'tipbox',
      author: 'Editorial Team',
      tags: ['Apple Silicon', 'M4', 'Technology', 'Innovation'],
    },
    {
      title: 'iPhone 17: Design Changes and New Color Options',
      content: `The iPhone 17 introduces subtle but meaningful design changes, along with new color options that give users more ways to express their style.

**Design Updates:**
The iPhone 17 features a refined design with slightly rounded edges for better ergonomics. The display is now brighter and more energy-efficient.

**New Colors:**
Apple has introduced three new color options: Titanium Blue, Natural Titanium, and Space Black. These colors complement the existing lineup and offer more variety.

**Durability:**
The iPhone 17 uses Ceramic Shield front cover, which is tougher than any smartphone glass. The device is also IP68 rated for water and dust resistance.

**Availability:**
The iPhone 17 is available in 128GB, 256GB, 512GB, and 1TB storage options. Pricing starts at $799.`,
      source: 'tipbox',
      author: 'Product Team',
      tags: ['iPhone 17', 'Design', 'Colors', 'Technology'],
      bannerImageKey: 'product.apple.iphone17' as SeedMediaKey,
    },
    {
      title: 'Apple Watch Ultra 3: Built for Extreme Adventures',
      content: `The Apple Watch Ultra 3 is designed for athletes and adventurers who push their limits. With enhanced durability and specialized features, it's the ultimate outdoor companion.

**Durability:**
The Ultra 3 features a titanium case that's both lightweight and incredibly strong. The display is protected by sapphire crystal, making it resistant to scratches and impacts.

**Battery Life:**
With up to 60 hours of battery life in low-power mode, the Ultra 3 can handle multi-day adventures. The new Action Button provides quick access to essential functions.

**Specialized Features:**
- Depth gauge for diving (up to 100 meters)
- Dual-frequency GPS for better accuracy
- Siren for emergencies
- Compass with waypoint marking

Whether you're climbing mountains, diving in oceans, or exploring remote locations, the Apple Watch Ultra 3 is built to keep up.`,
      source: 'tipbox',
      author: 'Adventure Team',
      tags: ['Apple Watch Ultra', 'Adventure', 'Fitness', 'Outdoor'],
      bannerImageKey: 'product.apple.watchultra3' as SeedMediaKey,
    },
    {
      title: 'Apple Environmental Initiatives: Carbon Neutral by 2030',
      content: `Apple has announced ambitious environmental goals, aiming to become carbon neutral across its entire business by 2030. This includes manufacturing, product use, and end-of-life recycling.

**Current Progress:**
Apple has already made significant progress, with all corporate facilities running on 100% renewable energy. The company is also working with suppliers to transition to clean energy.

**Product Design:**
New Apple products use more recycled materials than ever before. The iPhone 17, for example, uses 100% recycled rare earth elements in its magnets.

**Recycling Programs:**
Apple's trade-in and recycling programs help extend product lifecycles. The company has recovered over 1 million pounds of materials from recycled devices.

**Future Goals:**
By 2030, Apple plans to eliminate plastic from packaging and ensure all products are made with recycled or renewable materials. The company is also investing in carbon removal projects to offset remaining emissions.

This commitment to sustainability demonstrates Apple's responsibility as a global technology leader.`,
      source: 'tipbox',
      author: 'Sustainability Team',
      tags: ['Environment', 'Sustainability', 'Apple', 'Corporate'],
    },
  ];

  const createdNews: Array<{ id: string; title: string }> = [];

  // Her news için
  for (const newsConfig of newsConfigs) {
    // News oluştur veya bul
    let news = await prisma.news.findFirst({
      where: {
        brandId: brandId,
        title: newsConfig.title,
      },
    });

    if (!news) {
      news = await prisma.news.create({
        data: {
          id: randomUUID(),
          brandId: brandId,
          title: newsConfig.title,
          content: newsConfig.content,
          source: newsConfig.source,
          author: newsConfig.author,
          tags: newsConfig.tags,
          bannerImageUrl: newsConfig.bannerImageKey
            ? getSeedMediaPath(newsConfig.bannerImageKey, true) || undefined
            : undefined,
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          favoritesCount: 0,
          viewsCount: 0,
        },
      });
      console.log(`  ✅ News oluşturuldu: ${newsConfig.title.substring(0, 60)}...`);
    } else {
      console.log(`  ✅ News zaten var: ${newsConfig.title.substring(0, 60)}...`);
    }

    createdNews.push({
      id: news.id,
      title: news.title,
    });
  }

  console.log(`\n✅ Toplam ${createdNews.length} news oluşturuldu`);

  return {
    news: createdNews,
  };
}
