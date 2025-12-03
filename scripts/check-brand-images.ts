import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBrandImages() {
  console.log('🔍 Brand görselleri kontrol ediliyor...\n');

  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      imageUrl: true,
      logoUrl: true,
    },
  });

  console.log(`Toplam ${brands.length} brand bulundu\n`);

  const missingImages: Array<{ name: string; imageUrl: string | null; logoUrl: string | null }> = [];
  const existingImages: Array<{ name: string; imageUrl: string | null }> = [];

  for (const brand of brands) {
    if (!brand.imageUrl && !brand.logoUrl) {
      missingImages.push({ name: brand.name, imageUrl: null, logoUrl: null });
      continue;
    }

    if (brand.imageUrl || brand.logoUrl) {
      existingImages.push({ name: brand.name, imageUrl: brand.imageUrl });
    } else {
      missingImages.push({ name: brand.name, imageUrl: brand.imageUrl, logoUrl: brand.logoUrl });
    }
  }

  console.log('📊 RAPOR:\n');
  console.log(`✅ ImageUrl'i olan brand'ler: ${existingImages.length}`);
  console.log(`❌ ImageUrl'i olmayan brand'ler: ${missingImages.length}\n`);

  if (missingImages.length > 0) {
    console.log('❌ ImageUrl/LogoUrl olmayan brand\'ler:');
    missingImages.forEach(b => {
      console.log(`  - ${b.name}: imageUrl=${b.imageUrl || 'YOK'}, logoUrl=${b.logoUrl || 'YOK'}`);
    });
    console.log('');
  }

  // Benzersiz imageUrl'leri listele
  const uniqueImageUrls = new Set<string>();
  existingImages.forEach(b => {
    if (b.imageUrl) uniqueImageUrls.add(b.imageUrl);
  });

  console.log(`\n📁 Kullanılan benzersiz imageUrl sayısı: ${uniqueImageUrls.size}`);
  console.log('\n📋 Benzersiz imageUrl\'ler ve MinIO kontrolü:');
  
  const missingInMinIO: Array<{ path: string; url: string; brands: string[] }> = [];
  const existingInMinIO: string[] = [];
  const urlToBrands = new Map<string, string[]>();

  // Her URL için hangi brand'lerin kullandığını bul
  for (const brand of brands) {
    if (brand.imageUrl) {
      if (!urlToBrands.has(brand.imageUrl)) {
        urlToBrands.set(brand.imageUrl, []);
      }
      urlToBrands.get(brand.imageUrl)!.push(brand.name);
    }
  }

  for (const url of Array.from(uniqueImageUrls).sort()) {
    const path = url.match(/tipbox-media\/(.+)$/)?.[1] || url;
    const brandsUsing = urlToBrands.get(url) || [];
    
    // MinIO'da kontrol et (HTTP HEAD request)
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        existingInMinIO.push(path);
        console.log(`  ✅ ${path} - MinIO'da mevcut (${brandsUsing.length} brand kullanıyor)`);
      } else {
        missingInMinIO.push({ path, url, brands: brandsUsing });
        console.log(`  ❌ ${path} - MinIO'da YOK (Status: ${response.status})`);
        if (brandsUsing.length > 0) {
          console.log(`     Kullanan brand'ler: ${brandsUsing.join(', ')}`);
        }
      }
    } catch (error) {
      missingInMinIO.push({ path, url, brands: brandsUsing });
      console.log(`  ❌ ${path} - MinIO'da YOK veya erişilemiyor`);
      if (brandsUsing.length > 0) {
        console.log(`     Kullanan brand'ler: ${brandsUsing.join(', ')}`);
      }
    }
  }

  console.log(`\n📊 ÖZET:`);
  console.log(`  ✅ MinIO'da mevcut: ${existingInMinIO.length}`);
  console.log(`  ❌ MinIO'da eksik: ${missingInMinIO.length}`);

  if (missingInMinIO.length > 0) {
    console.log(`\n⚠️  MinIO'da olmayan görseller ve etkilenen brand'ler:`);
    missingInMinIO.forEach(item => {
      console.log(`  - ${item.path}`);
      if (item.brands.length > 0) {
        console.log(`    Etkilenen brand'ler: ${item.brands.join(', ')}`);
      }
    });
  }

  await prisma.$disconnect();
}

checkBrandImages()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  });

