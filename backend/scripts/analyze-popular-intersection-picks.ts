/**
 * Popular brand/category intersection picker analyzer
 *
 * Bu script, `prisma/seed.ts` içindeki popüler-kesişim ürün seçme mekanizmasını
 * DB'den çektiği ürün havuzu üzerinde N kez çalıştırıp dağılımı raporlar.
 *
 * Kullanım:
 *   npx ts-node scripts/analyze-popular-intersection-picks.ts
 *
 * Opsiyonlar:
 *   --runs 100            Kaç kez seçim yapılacağı (default: 100)
 *   --take 2000           DB'den çekilecek ürün sayısı (default: 2000)
 *   --slice 500           Havuzu N adet ile sınırlar (0 ise limit yok)
 *   --pool intersection   Ürün havuzu: intersection | all (default: intersection)
 *   --preferred           Preferred pair önceliğini açar (default: kapalı)
 *   --preferred-chance 1  Preferred pair'in devreye girme olasılığı (0..1, default: 0)
 *   --beauty-chance 0.4   Kozmetik/beauty pair'lerini bias'lar (0..1, default: 0)
 *   --strategy uniform-pair Seçim stratejisi: seed | weighted-pair | uniform-pair | topk-pair | round-robin-pair (default: uniform-pair)
 *   --topk 5              strategy=topk-pair iken kullanılacak K (default: 5)
 *   --dedupe              Aynı productId tekrar seçilmesin (mümkünse)
 *   --show-samples 10     İlk N pick'i detaylı basar (default: 10)
 */

import { getPrisma, disconnectPrisma } from '../src/infrastructure/repositories/prisma.client';
import {
  buildNormalizedSet,
  buildPairMap,
  clamp01,
  compactText,
  createRoundRobinPairPicker,
  isPopularIntersectionProduct,
  normalizeName,
  pickProductFromPairMap,
  type PoolMode,
  type PreferredPair,
  type Strategy,
} from '../prisma/seed/helpers/product-pick-strategies';

const prisma = getPrisma();

// Popüler marka/kategori listeleri (DB: Top N by Product Count)
// NOT: Case-insensitive eşleşme için normalize set'leri kullanılır.
const POPULAR_BRAND_NAMES = [
  'HP',
  'SAMSUNG',
  'Apple',
  'Dell',
  'REVLON',
  'Sony',
  'Lenovo',
  "L'Oreal Paris",
  'NYX PROFESSIONAL MAKEUP',
  'MAYBELLINE',
  'NEEWER',
  'K&F CONCEPT',
  'ASUS',
  'Neutrogena',
  'Bath & Body Works',
];

const POPULAR_CATEGORY_NAMES = [
  'Laptops',
  'Carrier Cell Phones',
  'Desktops',
  'Accessories',
  'Selfie Sticks & Tripods',
  'Accessory Kits',
  'Sets & Kits',
  'Masks',
  'Face Moisturizers',
  'Face Mists',
  'Soaps',
  'Gels',
  'Balms & Moisturizers',
  'Lip Sunscreens',
];

const normalizedPopularBrandNames = buildNormalizedSet(POPULAR_BRAND_NAMES);
const normalizedPopularCategoryNames = buildNormalizedSet(POPULAR_CATEGORY_NAMES);

// Seed'deki mevcut davranış: preferred pair varsa her çağrıda önceliklenir
const PREFERRED_BRAND_CATEGORY_PAIRS: PreferredPair[] = [{ brand: 'Apple', category: 'Carrier Cell Phones' }];

// Beauty bias için marka/kategori kümeleri
// (POPULER listeler içinde olup kozmetik tarafını temsil edenler)
const BEAUTY_BRAND_NAMES = ["L'Oreal Paris", 'NYX PROFESSIONAL MAKEUP', 'MAYBELLINE', 'Neutrogena', 'REVLON', 'Bath & Body Works'];
const BEAUTY_CATEGORY_NAMES = [
  'Sets & Kits',
  'Masks',
  'Face Moisturizers',
  'Face Mists',
  'Soaps',
  'Gels',
  'Balms & Moisturizers',
  'Lip Sunscreens',
];
const normalizedBeautyBrandNames = buildNormalizedSet(BEAUTY_BRAND_NAMES);
const normalizedBeautyCategoryNames = buildNormalizedSet(BEAUTY_CATEGORY_NAMES);

function getNumberArg(name: string, defaultValue: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return defaultValue;
  const raw = process.argv[idx + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function inc(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) || 0) + by);
}

function toSortedEntries(map: Map<string, number>): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function formatProductLine(input: {
  count: number;
  id: string;
  brand: string;
  category: string;
  name: string;
}): string {
  // id'yi başa al: terminal satır kırımlarında kaybolmasın
  return `- ${input.count}x | id=${input.id} | ${input.brand} | ${input.category} | ${compactText(input.name, 90)}`;
}

function getStringArg<T extends string>(name: string, defaultValue: T): T {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return defaultValue;
  const raw = process.argv[idx + 1];
  return (raw as T) || defaultValue;
}

async function main() {
  const runs = Math.max(1, getNumberArg('--runs', 100));
  // Default'u büyüt: ilk 2000 ürün "elektronik ağırlıklı" kalabiliyor.
  // (Parametre vermeden çalıştırıldığında beauty havuzunu büyütmek için.)
  const take = Math.max(1, getNumberArg('--take', 20000));
  const slice = Math.max(0, getNumberArg('--slice', 0));
  const showSamples = Math.max(0, getNumberArg('--show-samples', 10));
  const preferredPairs = hasFlag('--preferred') ? PREFERRED_BRAND_CATEGORY_PAIRS : [];
  const preferredChance = clamp01(getNumberArg('--preferred-chance', 0));
  // Parametre vermeden çalıştırıldığında "beauty" tarafı daha sık gelsin.
  // Bu sadece "analyzer" davranışı; seed'e dokunmadan dağılımı görmek/ayarlamak için.
  const beautyChance = clamp01(getNumberArg('--beauty-chance', 0)); // legacy: ratio bazlı seçim varken default kapalı
  const beautyTargetRatio = clamp01(getNumberArg('--beauty-target-ratio', 0.4)); // default: %40 beauty / %60 electronic
  const strategy = getStringArg<Strategy>('--strategy', 'uniform-pair');
  const topk = Math.max(1, getNumberArg('--topk', 5));
  const poolMode = getStringArg<PoolMode>('--pool', 'intersection');
  const dedupe = hasFlag('--dedupe');

  console.log('🔎 Popular Intersection Picker Analyzer\n');
  console.log(`- runs: ${runs}`);
  console.log(`- take: ${take}`);
  console.log(`- slice: ${slice || 'none'}`);
  console.log(`- preferredPairs: ${preferredPairs.length ? JSON.stringify(preferredPairs) : '(disabled)'}\n`);
  console.log(`- preferredChance: ${preferredChance}`);
  console.log(`- beautyChance: ${beautyChance}`);
  console.log(`- beautyTargetRatio: ${beautyTargetRatio}`);
  console.log(`- strategy: ${strategy}`);
  console.log(`- topk: ${topk}\n`);
  console.log(`- pool: ${poolMode}`);
  console.log(`- dedupe: ${dedupe}\n`);

  // Not: Daha önce "take=2000" ile rastgele ilk ürünler geliyordu → beauty tarafı havuzda çok az kalabiliyordu.
  // Burada DB'den doğrudan POPULAR_BRAND_NAMES x POPULAR_CATEGORY_NAMES intersection filtresiyle çekiyoruz.
  const popularBrandWhere = POPULAR_BRAND_NAMES.map(name => ({
    name: { equals: name, mode: 'insensitive' as const },
  }));
  const popularCategoryWhere = POPULAR_CATEGORY_NAMES.map(name => ({
    name: { equals: name, mode: 'insensitive' as const },
  }));

  const allProducts = await prisma.product.findMany({
    take,
    where: {
      AND: [
        { brand: { is: { OR: popularBrandWhere } } },
        { category: { is: { OR: popularCategoryWhere } } },
      ],
    },
    include: {
      brand: { select: { externalId: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  if (allProducts.length === 0) {
    throw new Error('❌ Ürün bulunamadı. Önce ürünlerin seed edildiğinden emin olun.');
  }

  // Brand+Category yoksa pair bazlı analiz anlamsız; bunları ele
  // (Bu noktada where filtresi zaten brand+category varlığını büyük ölçüde garanti eder.)
  const basePool = allProducts.filter(p => Boolean(p.brand?.name) && Boolean(p.category?.name));

  const intersectionProducts = basePool.filter(p =>
    isPopularIntersectionProduct(p, normalizedPopularBrandNames, normalizedPopularCategoryNames),
  );

  // POPULAR_BRAND_NAMES + POPULAR_CATEGORY_NAMES dışına çıkma garantisi:
  // intersection pool boşsa, alakasız ürün seçmek yerine direkt hata ver.
  if (intersectionProducts.length === 0) {
    throw new Error(
      `❌ Popular intersection pool boş. ` +
        `POPULAR_BRAND_NAMES(${POPULAR_BRAND_NAMES.length}) ve POPULAR_CATEGORY_NAMES(${POPULAR_CATEGORY_NAMES.length}) ` +
        `listeleri ile DB ürünleri eşleşmiyor olabilir. (basePool=${basePool.length})`,
    );
  }

  if (poolMode === 'all') {
    console.warn('⚠️  --pool all deprecated: çıktı popular-only kalacak şekilde intersection pool kullanılacak.');
  }

  const selectedPoolRaw = intersectionProducts;

  const pool = selectedPoolRaw.slice(0, slice || undefined);
  const pairMapSource = pool;
  const pairMap = buildPairMap(pairMapSource);

  const beautyPool = pool.filter(p => {
    const b = normalizeName(p.brand?.name);
    const c = normalizeName(p.category?.name);
    return (b && normalizedBeautyBrandNames.has(b)) || (c && normalizedBeautyCategoryNames.has(c));
  });
  const nonBeautyPool = pool.filter(p => !beautyPool.includes(p));

  const beautyPairKeys = Array.from(pairMap.keys()).filter(key => {
    const [brand, category] = key.split('||');
    if (!brand || !category) return false;
    return normalizedBeautyBrandNames.has(brand) || normalizedBeautyCategoryNames.has(category);
  });

  const preferredKey = `${normalizeName('Apple')}||${normalizeName('Carrier Cell Phones')}`;
  const preferredBucketSize = pairMap.get(preferredKey)?.length || 0;

  console.log('📦 Pool Stats');
  console.log(`- allProducts: ${allProducts.length}`);
  console.log(`- basePool(brand+category): ${basePool.length}`);
  console.log(`- intersectionProducts: ${intersectionProducts.length}`);
  console.log(`- poolUsed: ${pool.length}`);
  console.log(`- pairMapKeys: ${pairMap.size}`);
  console.log(`- preferredBucketSize (apple||carrier cell phones): ${preferredBucketSize}\n`);
  console.log(`- beautyPairKeys: ${beautyPairKeys.length}`);
  console.log(`- beautyPoolSize: ${beautyPool.length}\n`);

  const countByProductId = new Map<string, number>();
  const countByBrand = new Map<string, number>();
  const countByCategory = new Map<string, number>();
  const countByPair = new Map<string, number>();

  const sampleRows: Array<{ idx: number; id: string; name: string; brand: string; category: string; pair: string }> = [];

  const seenProductIds = new Set<string>();
  const beautyTarget = Math.round(runs * beautyTargetRatio);
  let beautyPicked = 0;

  const picker: (() => (typeof pool)[number]) | null =
    strategy === 'round-robin-pair'
      ? createRoundRobinPairPicker(pairMap, pool, { preferredPairs, preferredChance, dedupe })
      : null;

  for (let i = 0; i < runs; i++) {
    const pickBase = () =>
      picker?.() ??
      (pickProductFromPairMap(pairMap, pool, {
        preferredPairs,
        preferredChance,
        strategy: strategy as Exclude<Strategy, 'round-robin-pair'>,
        topk,
      }) as (typeof pool)[number]);

    const tryPickFromPool = (arr: typeof pool): (typeof pool)[number] | null => {
      if (arr.length === 0) return null;
      for (let attempt = 0; attempt < 35; attempt++) {
        const p = arr[Math.floor(Math.random() * arr.length)]!;
        if (!dedupe) return p;
        if (!seenProductIds.has(p.id)) return p;
      }
      return null;
    };

    // Hedef oranı *mümkün olduğunca* tuttur:
    // remaining picks içinde kaç beauty'e ihtiyacımız var ise, o oranda beauty seç.
    // Kritik durumlarda (kalan pick sayısı <= beauty ihtiyacı) beauty'yi zorla.
    const remaining = runs - i;
    const needBeauty = Math.max(0, beautyTarget - beautyPicked);
    const mustPickBeauty = beautyPool.length > 0 && needBeauty >= remaining;
    const mustPickNonBeauty = nonBeautyPool.length > 0 && needBeauty <= 0;

    const beautyProb = mustPickBeauty ? 1 : mustPickNonBeauty ? 0 : remaining > 0 ? needBeauty / remaining : 0;
    const chooseBeauty = Math.random() < beautyProb;

    let picked: (typeof pool)[number] | null = null;

    if (chooseBeauty) picked = tryPickFromPool(beautyPool);
    else picked = tryPickFromPool(nonBeautyPool);

    // Fallback: ratio pool boşsa veya dedupe yüzünden seçilemediyse base picker'a düş.
    // Ayrıca legacy beautyChance istenirse (parametreyle) ratio tutarken ekstra bias uygulanabilir.
    if (!picked && beautyChance > 0 && beautyPool.length > 0 && Math.random() < beautyChance) {
      picked = tryPickFromPool(beautyPool);
    }
    picked = picked ?? pickBase();

    const ok = isPopularIntersectionProduct(picked, normalizedPopularBrandNames, normalizedPopularCategoryNames);
    if (!ok) {
      throw new Error(
        `❌ Intersection dışına çıkan pick tespit edildi: ` +
          `id=${picked.id} brand="${picked.brand?.name ?? ''}" category="${picked.category?.name ?? ''}"`,
      );
    }
    if (dedupe) seenProductIds.add(picked.id);
    const brand = picked.brand?.name || '(no-brand)';
    const category = picked.category?.name || '(no-category)';
    const pair = `${normalizeName(brand)}||${normalizeName(category)}`;
    const isBeautyPick =
      normalizedBeautyBrandNames.has(normalizeName(brand)) || normalizedBeautyCategoryNames.has(normalizeName(category));
    if (isBeautyPick) beautyPicked += 1;

    inc(countByProductId, picked.id);
    inc(countByBrand, brand);
    inc(countByCategory, category);
    inc(countByPair, pair);

    if (sampleRows.length < showSamples) {
      sampleRows.push({ idx: i + 1, id: picked.id, name: picked.name, brand, category, pair });
    }
  }

  const uniqueProducts = countByProductId.size;
  const duplicates = runs - uniqueProducts;

  console.log('📊 Results');
  console.log(`- uniqueProducts: ${uniqueProducts}/${runs}`);
  console.log(`- duplicates: ${duplicates}\n`);

  const topProducts = toSortedEntries(countByProductId).slice(0, 15);
  console.log('🏷️ Top Products (by frequency)');
  for (const [productId, count] of topProducts) {
    const p = pool.find(x => x.id === productId) || allProducts.find(x => x.id === productId);
    const brand = p?.brand?.name || '(no-brand)';
    const category = p?.category?.name || '(no-category)';
    console.log(
      formatProductLine({
        count,
        id: productId,
        brand,
        category,
        name: p?.name || '(unknown)',
      }),
    );
  }
  console.log('');

  const topPairs = toSortedEntries(countByPair).slice(0, 15);
  console.log('🔁 Top Brand||Category pairs (by frequency)');
  for (const [pair, count] of topPairs) {
    console.log(`- ${count}x | ${pair}`);
  }
  console.log('');

  const topBrands = toSortedEntries(countByBrand).slice(0, 15);
  console.log('🏭 Top Brands (by frequency)');
  for (const [brand, count] of topBrands) {
    console.log(`- ${count}x | ${brand}`);
  }
  console.log('');

  const topCategories = toSortedEntries(countByCategory).slice(0, 15);
  console.log('🗂️ Top Categories (by frequency)');
  for (const [category, count] of topCategories) {
    console.log(`- ${count}x | ${category}`);
  }
  console.log('');

  const appleCarrierPickedCount = countByPair.get(preferredKey) || 0;
  console.log('🍎 Preferred Pair Impact');
  console.log(`- apple||carrier cell phones picks: ${appleCarrierPickedCount}/${runs} (${((appleCarrierPickedCount / runs) * 100).toFixed(1)}%)\n`);

  if (sampleRows.length > 0) {
    console.log(`🧾 First ${sampleRows.length} picks`);
    for (const row of sampleRows) {
      console.log(`- #${row.idx}: id=${row.id} | ${row.brand} | ${row.category} | ${compactText(row.name, 90)}`);
    }
    console.log('');
  }
}

main()
  .then(async () => {
    await disconnectPrisma();
    process.exit(0);
  })
  .catch(async err => {
    console.error('❌ Script failed:', err);
    await disconnectPrisma();
    process.exit(1);
  });

