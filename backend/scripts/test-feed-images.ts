import { PrismaClient } from '@prisma/client';
import { FeedService } from './src/application/feed/feed.service';

const prisma = new PrismaClient();
const feedService = new FeedService();

async function testFeedImages() {
  try {
    // Ömer kullanıcısının ID'si
    const userId = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    
    console.log('📡 Feed endpoint\'ine istek atılıyor...');
    console.log(`User ID: ${userId}\n`);
    
    // Feed'i getir
    const feed = await feedService.getUserFeed(userId, { limit: 5 });
    
    console.log(`✅ Feed başarıyla alındı!`);
    console.log(`📊 Toplam item sayısı: ${feed.items.length}\n`);
    
    // Her item için image URL'lerini kontrol et
    feed.items.forEach((item, index) => {
      console.log(`\n--- Item ${index + 1} (${item.type}) ---`);
      console.log(`Post ID: ${item.data.id}`);
      console.log(`User: ${item.data.user.name}`);
      console.log(`User Avatar: ${item.data.user.avatar || 'YOK'}`);
      
      // Images kontrolü
      if ('images' in item.data && item.data.images) {
        console.log(`\n📸 Post Images (${item.data.images.length} adet):`);
        item.data.images.forEach((img, imgIndex) => {
          console.log(`  ${imgIndex + 1}. ${img}`);
          if (img.includes('localhost') || img.includes('127.0.0.1')) {
            console.log(`     ⚠️  UYARI: localhost içeriyor!`);
          }
        });
      } else {
        console.log(`\n📸 Post Images: YOK`);
      }
      
      // Context data image kontrolü
      if ('contextData' in item.data && item.data.contextData) {
        const contextData = item.data.contextData as any;
        if (contextData.image) {
          console.log(`\n🖼️  Context Image: ${contextData.image}`);
          if (contextData.image.includes('localhost') || contextData.image.includes('127.0.0.1')) {
            console.log(`     ⚠️  UYARI: localhost içeriyor!`);
          }
        } else {
          console.log(`\n🖼️  Context Image: YOK`);
        }
      }
      
      // Benchmark products images
      if ('products' in item.data && item.data.products) {
        const products = item.data.products as any[];
        console.log(`\n📦 Products (${products.length} adet):`);
        products.forEach((product, prodIndex) => {
          console.log(`  ${prodIndex + 1}. ${product.name}`);
          if (product.image) {
            console.log(`     Image: ${product.image}`);
            if (product.image.includes('localhost') || product.image.includes('127.0.0.1')) {
              console.log(`     ⚠️  UYARI: localhost içeriyor!`);
            }
          } else {
            console.log(`     Image: YOK`);
          }
        });
      }
    });
    
    console.log(`\n\n📋 Özet:`);
    console.log(`- Toplam item: ${feed.items.length}`);
    console.log(`- Pagination: ${JSON.stringify(feed.pagination, null, 2)}`);
    
    // localhost kontrolü
    const allImages: string[] = [];
    feed.items.forEach(item => {
      if (item.data.user.avatar) allImages.push(item.data.user.avatar);
      if ('images' in item.data && item.data.images) {
        allImages.push(...item.data.images);
      }
      if ('contextData' in item.data && item.data.contextData) {
        const ctx = item.data.contextData as any;
        if (ctx.image) allImages.push(ctx.image);
      }
      if ('products' in item.data && item.data.products) {
        const products = item.data.products as any[];
        products.forEach(p => {
          if (p.image) allImages.push(p.image);
        });
      }
    });
    
    const localhostImages = allImages.filter(img => 
      img.includes('localhost') || img.includes('127.0.0.1')
    );
    
    console.log(`\n🔍 Image URL Analizi:`);
    console.log(`- Toplam image URL: ${allImages.length}`);
    console.log(`- localhost içeren: ${localhostImages.length}`);
    if (localhostImages.length > 0) {
      console.log(`\n⚠️  PROBLEM: localhost içeren URL'ler:`);
      localhostImages.forEach(img => console.log(`  - ${img}`));
    } else {
      console.log(`✅ Tüm URL'ler localhost içermiyor!`);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFeedImages();

