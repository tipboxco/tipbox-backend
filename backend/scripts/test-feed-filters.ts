import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = 'omer@tipbox.co';
const PASSWORD = 'password123';

interface TestResult {
  name: string;
  success: boolean;
  itemCount: number;
  total?: number;
  error?: string;
  filters?: any;
}

async function login(): Promise<{ token: string; userId: string }> {
  console.log('\n🔐 Login yapılıyor...');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });
    
    const token = response.data.token;
    const userId = response.data.id || response.data.userId;
    
    if (!token || !userId) {
      throw new Error('Token veya userId alınamadı');
    }
    
    console.log(`✅ Login başarılı - User ID: ${userId}`);
    return { token, userId };
  } catch (error: any) {
    console.error('❌ Login hatası:', error.response?.data || error.message);
    throw error;
  }
}

async function testFilter(
  name: string,
  token: string,
  filters: Record<string, any>
): Promise<TestResult> {
  console.log(`\n🧪 Test: ${name}`);
  console.log(`   Filtreler:`, JSON.stringify(filters, null, 2));
  
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.append(key, String(value));
      }
    });
    
    const response = await axios.get(`${BASE_URL}/feed/filtered?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const items = response.data.items || [];
    const pagination = response.data.pagination || {};
    
    console.log(`   ✅ Başarılı - ${items.length} item, Total: ${pagination.total || 'N/A'}`);
    
    if (items.length > 0) {
      console.log(`   📋 İlk 3 item:`);
      items.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`      ${index + 1}. Type: ${item.type}, Post ID: ${item.data?.id}, Source: ${item.data?.source || 'N/A'}`);
      });
    }
    
    return {
      name,
      success: true,
      itemCount: items.length,
      total: pagination.total,
      filters,
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;
    console.log(`   ❌ Hata: ${errorMsg}`);
    return {
      name,
      success: false,
      itemCount: 0,
      error: errorMsg,
      filters,
    };
  }
}

async function getCategories(token: string): Promise<{ mainCategories: any[]; subCategories: any[] }> {
  console.log('\n📂 Kategoriler alınıyor...');
  try {
    const [mainRes, subRes] = await Promise.all([
      axios.get(`${BASE_URL}/catalog/main-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${BASE_URL}/catalog/sub-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    
    const mainCategories = mainRes.data.mainCategories || [];
    const subCategories = subRes.data.subCategories || [];
    
    console.log(`✅ ${mainCategories.length} ana kategori, ${subCategories.length} alt kategori bulundu`);
    
    return { mainCategories, subCategories };
  } catch (error: any) {
    console.warn('⚠️  Kategoriler alınamadı, devam ediliyor...');
    return { mainCategories: [], subCategories: [] };
  }
}

async function getFeedSourceCounts(token: string): Promise<Record<string, number>> {
  console.log('\n📊 Feed source sayıları alınıyor...');
  try {
    const response = await axios.get(`${BASE_URL}/feed/source-counts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const counts = response.data.counts || {};
    console.log('✅ Feed source sayıları:');
    Object.entries(counts).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}`);
    });
    
    return counts;
  } catch (error: any) {
    console.warn('⚠️  Feed source sayıları alınamadı');
    return {};
  }
}

async function main() {
  console.log('🧪 Feed Filtreleri Test Başlatılıyor...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  const { token, userId } = await login();
  
  // Kategorileri al
  const { mainCategories, subCategories } = await getCategories(token);
  const firstMainCategory = mainCategories[0];
  const firstSubCategory = subCategories[0];
  
  // Feed source sayılarını al
  const sourceCounts = await getFeedSourceCounts(token);
  const availableSources = Object.keys(sourceCounts).filter((s) => (sourceCounts[s] as number) > 0);
  
  console.log(`\n📋 Mevcut feed source'lar: ${availableSources.join(', ')}`);
  
  const results: TestResult[] = [];
  
  // Test 1: Tüm filtreler olmadan (basit feed)
  results.push(await testFilter('1. Filtresiz Feed', token, {}));
  
  // Test 2: Interests (FeedSource) filtreleri
  if (availableSources.length > 0) {
    results.push(await testFilter('2. Interests: TRUSTER', token, {
      interests: ['TRUSTER'],
    }));
    
    results.push(await testFilter('3. Interests: BOOSTED', token, {
      interests: ['BOOSTED'],
    }));
    
    results.push(await testFilter('4. Interests: MUTUAL_TRUST', token, {
      interests: ['MUTUAL_TRUST'],
    }));
    
    if (availableSources.length > 1) {
      results.push(await testFilter('5. Interests: Çoklu (TRUSTER + BOOSTED)', token, {
        interests: ['TRUSTER', 'BOOSTED'],
      }));
    }
  }
  
  // Test 3: Tags filtreleri
  results.push(await testFilter('6. Tags: Question', token, {
    tags: ['Question'],
  }));
  
  results.push(await testFilter('7. Tags: Tips', token, {
    tags: ['Tips'],
  }));
  
  results.push(await testFilter('8. Tags: Review', token, {
    tags: ['Review'],
  }));
  
  results.push(await testFilter('9. Tags: Çoklu (Question + Tips)', token, {
    tags: ['Question', 'Tips'],
  }));
  
  // Test 4: Category filtreleri
  // Kategorileri doğrudan DB'den al (feed'de post olan kategoriler)
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  // Technology kategorisini bul
  const technologyCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Technology' },
  });
  
  // Akıllı Telefonlar alt kategorisini bul
  const phoneSubCategory = await prisma.subCategory.findFirst({
    where: { name: 'Akıllı Telefonlar' },
  });
  
  // Ev & Yaşam kategorisini bul
  const evYasamCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Ev & Yaşam' },
  });
  
  await prisma.$disconnect();
  
  if (technologyCategory?.id) {
    results.push(await testFilter('10. Category: Technology (Ana Kategori)', token, {
      category: technologyCategory.id,
    }));
  }
  
  if (phoneSubCategory?.id) {
    results.push(await testFilter('11. Category: Akıllı Telefonlar (Alt Kategori)', token, {
      category: phoneSubCategory.id,
    }));
  }
  
  if (evYasamCategory?.id) {
    results.push(await testFilter('11b. Category: Ev & Yaşam (Ana Kategori)', token, {
      category: evYasamCategory.id,
    }));
  }
  
  // Test 5: Sort filtreleri
  results.push(await testFilter('12. Sort: Recent', token, {
    sort: 'recent',
  }));
  
  results.push(await testFilter('13. Sort: Top', token, {
    sort: 'top',
  }));
  
  // Test 6: Kombine filtreler
  if (availableSources.length > 0 && technologyCategory?.id) {
    results.push(await testFilter('14. Kombine: Interests + Category', token, {
      interests: [availableSources[0]],
      category: technologyCategory.id,
    }));
  }
  
  results.push(await testFilter('15. Kombine: Tags + Sort', token, {
    tags: ['Question'],
    sort: 'top',
  }));
  
  if (availableSources.length > 0) {
    results.push(await testFilter('16. Kombine: Interests + Tags + Sort', token, {
      interests: [availableSources[0]],
      tags: ['Tips'],
      sort: 'recent',
    }));
  }
  
  if (technologyCategory?.id && availableSources.length > 0) {
    results.push(await testFilter('17. Kombine: Interests + Category + Tags + Sort', token, {
      interests: [availableSources[0]],
      category: technologyCategory.id,
      tags: ['Question'],
      sort: 'top',
    }));
  }
  
  // Özet
  console.log('\n\n📊 TEST ÖZETİ');
  console.log('='.repeat(80));
  
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0);
  
  console.log(`✅ Başarılı: ${successCount}`);
  console.log(`❌ Başarısız: ${failCount}`);
  console.log(`📝 Toplam Test: ${results.length}`);
  console.log(`📦 Toplam Item: ${totalItems}`);
  console.log('\n');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const itemInfo = result.total !== undefined 
      ? `${result.itemCount} item (Total: ${result.total})`
      : `${result.itemCount} item`;
    console.log(`${status} ${result.name}: ${itemInfo}`);
    if (result.error) {
      console.log(`   Hata: ${result.error}`);
    }
  });
  
  console.log('\n✅ Test tamamlandı!');
}

main()
  .catch((error) => {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  });

