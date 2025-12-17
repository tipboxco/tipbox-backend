/**
 * PostMedia URL'lerini Kontrol Etme Script'i
 * 
 * Bu script, PostMedia tablosundaki görsel URL'lerini analiz eder.
 * 
 * Kullanım:
 *   npx ts-node scripts/check-post-media-urls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPostMediaUrls(): Promise<void> {
  try {
    console.log('🔍 PostMedia URL\'leri kontrol ediliyor...\n');

    // PostMedia kayıtlarını al
    const postMedia = await prisma.postMedia.findMany({
      take: 100, // İlk 100 kayıt
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        postId: true,
        userId: true,
        mediaUrl: true,
        orderIndex: true,
        createdAt: true,
      },
    });

    console.log(`📊 Toplam PostMedia kaydı: ${postMedia.length}\n`);

    if (postMedia.length === 0) {
      console.log('⚠️  PostMedia tablosunda kayıt yok.');
      return;
    }

    // URL'leri analiz et
    const urlAnalysis = {
      minioLocal: 0,
      minioProduction: 0,
      external: 0,
      invalid: 0,
      domains: new Set<string>(),
      paths: new Map<string, number>(),
    };

    console.log('📋 URL Analizi:\n');
    console.log('═'.repeat(80));

    for (const media of postMedia) {
      const url = media.mediaUrl;
      
      // Domain'i çıkar
      try {
        const urlObj = new URL(url);
        urlAnalysis.domains.add(urlObj.hostname);

        // Path'in ilk kısmını al (klasör adı)
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length > 1) {
          const folder = pathParts[1]; // bucket adından sonraki ilk klasör
          urlAnalysis.paths.set(folder, (urlAnalysis.paths.get(folder) || 0) + 1);
        }

        // URL tipini belirle
        if (url.includes('localhost:9000') || url.includes('minio:9000')) {
          urlAnalysis.minioLocal++;
        } else if (url.includes('api-test.tipbox.co:9000')) {
          urlAnalysis.minioProduction++;
        } else if (url.includes('http://') || url.includes('https://')) {
          urlAnalysis.external++;
        } else {
          urlAnalysis.invalid++;
        }
      } catch (error) {
        urlAnalysis.invalid++;
      }
    }

    // Sonuçları göster
    console.log(`\n📊 URL İstatistikleri:`);
    console.log(`   🏠 Local MinIO (localhost/minio): ${urlAnalysis.minioLocal}`);
    console.log(`   🌐 Production MinIO (api-test.tipbox.co): ${urlAnalysis.minioProduction}`);
    console.log(`   🔗 External URL: ${urlAnalysis.external}`);
    console.log(`   ❌ Invalid URL: ${urlAnalysis.invalid}`);

    console.log(`\n🌐 Kullanılan Domain'ler:`);
    urlAnalysis.domains.forEach((domain) => {
      console.log(`   - ${domain}`);
    });

    console.log(`\n📁 Klasör Dağılımı:`);
    const sortedPaths = Array.from(urlAnalysis.paths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [folder, count] of sortedPaths) {
      console.log(`   - ${folder}/: ${count} görsel`);
    }

    // Örnek URL'ler göster
    console.log(`\n📝 Örnek URL'ler (ilk 5):`);
    postMedia.slice(0, 5).forEach((media, index) => {
      console.log(`\n   ${index + 1}. Post: ${media.postId}`);
      console.log(`      URL: ${media.mediaUrl}`);
      console.log(`      Order: ${media.orderIndex}`);
      console.log(`      Created: ${media.createdAt.toISOString()}`);
    });

    // Frontend için öneriler
    console.log('\n' + '═'.repeat(80));
    console.log('\n💡 Frontend için Öneriler:\n');

    if (urlAnalysis.minioLocal > 0) {
      console.log('⚠️  Local MinIO URL\'leri tespit edildi!');
      console.log('   Bu URL\'ler production\'da çalışmayacak.');
      console.log('   Çözüm: URL\'leri production MinIO endpoint\'ine çevirmek gerekir.\n');
    }

    if (urlAnalysis.minioProduction > 0) {
      console.log('✅ Production MinIO URL\'leri mevcut.');
      console.log('   Bu URL\'ler doğrudan kullanılabilir.\n');
    }

    if (urlAnalysis.external > 0) {
      console.log('🔗 External URL\'ler tespit edildi.');
      console.log('   Bu URL\'ler CDN veya başka bir storage\'dan gelebilir.\n');
    }

    console.log('📌 Frontend\'de görselleri gösterirken:');
    console.log('   1. URL\'nin geçerli olduğundan emin olun');
    console.log('   2. CORS ayarlarını kontrol edin');
    console.log('   3. Production\'da public read policy\'nin aktif olduğundan emin olun');
    console.log('   4. Gerekirse pre-signed URL kullanın');

  } catch (error) {
    console.error('❌ Hata:', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPostMediaUrls()
  .then(() => {
    console.log('\n✅ URL kontrolü tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });
