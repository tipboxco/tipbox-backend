/**
 * Veritabanındaki postları kontrol edip seed.ts'ye ekleyen script
 * 
 * Bu script:
 * 1. Veritabanındaki tüm postları alır
 * 2. Seed.ts dosyasındaki mevcut postları analiz eder
 * 3. Seed.ts'de olmayan postları bulur (userId bazlı)
 * 4. Bu postları seed.ts dosyasına ekler
 * 
 * Kullanım:
 *   # Önce dry-run ile test edin (dosyaya yazmaz, sadece gösterir)
 *   npx ts-node scripts/sync-posts-to-seed.ts --dry-run
 *   
 *   # Gerçek ekleme için
 *   npx ts-node scripts/sync-posts-to-seed.ts
 * 
 * Not: Veritabanı bağlantısı gereklidir (DATABASE_URL env değişkeni)
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface PostData {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  productId: string | null;
  productGroupId: string | null;
  mainCategoryId: string | null;
  subCategoryId: string | null;
  inventoryRequired: boolean;
  isBoosted: boolean;
  boostedUntil: Date | null;
  createdAt: Date;
  // İlişkili veriler
  question?: {
    expectedAnswerFormat: string;
    relatedProductId: string | null;
  } | null;
  tip?: {
    tipCategory: string;
    isVerified: boolean;
  } | null;
  comparison?: {
    product1Id: string;
    product2Id: string;
    comparisonSummary: string | null;
    scores?: Array<{
      metricId: string;
      scoreProduct1: number;
      scoreProduct2: number;
      comment: string | null;
    }>;
  } | null;
  tags?: string[];
  media?: Array<{
    mediaUrl: string;
    orderIndex: number;
  }>;
}

async function getAllPostsFromDatabase(): Promise<PostData[]> {
  console.log('📊 Veritabanındaki tüm postlar alınıyor...');
  
  const posts = await prisma.contentPost.findMany({
    include: {
      question: true,
      tip: true,
      comparison: {
        include: {
          scores: true,
        },
      },
      tags: true,
      media: {
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return posts.map(post => ({
    id: post.id,
    userId: post.userId,
    type: post.type,
    title: post.title,
    body: post.body,
    productId: post.productId,
    productGroupId: post.productGroupId,
    mainCategoryId: post.mainCategoryId,
    subCategoryId: post.subCategoryId,
    inventoryRequired: post.inventoryRequired,
    isBoosted: post.isBoosted,
    boostedUntil: post.boostedUntil,
    createdAt: post.createdAt,
    question: post.question ? {
      expectedAnswerFormat: post.question.expectedAnswerFormat,
      relatedProductId: post.question.relatedProductId,
    } : null,
    tip: post.tip ? {
      tipCategory: post.tip.tipCategory,
      isVerified: post.tip.isVerified,
    } : null,
    comparison: post.comparison ? {
      product1Id: post.comparison.product1Id,
      product2Id: post.comparison.product2Id,
      comparisonSummary: post.comparison.comparisonSummary,
      scores: post.comparison.scores.map(score => ({
        metricId: score.metricId,
        scoreProduct1: score.scoreProduct1,
        scoreProduct2: score.scoreProduct2,
        comment: score.comment,
      })),
    } : null,
    tags: post.tags.map(t => t.tag),
    media: post.media.map(m => ({
      mediaUrl: m.mediaUrl,
      orderIndex: m.orderIndex,
    })),
  }));
}

async function getSeedPosts(): Promise<{ titles: Set<string>; userIds: Set<string> }> {
  console.log('📖 Seed.ts dosyasındaki postlar analiz ediliyor...');
  
  const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
  const seedContent = fs.readFileSync(seedPath, 'utf-8');
  
  // Seed.ts'deki tüm title'ları bul
  const titleRegex = /title:\s*['"`]([^'"`]+)['"`]/g;
  const titles = new Set<string>();
  let match;
  
  while ((match = titleRegex.exec(seedContent)) !== null) {
    titles.add(match[1]);
  }
  
  // Seed.ts'deki userId'leri bul (sabit tanımlı userId'ler)
  const userIds = new Set<string>();
  
  // TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS, vb.
  const userIdRegex = /(?:TEST_USER_ID|TARGET_USER_ID|TRUST_USER_IDS|TRUSTER_USER_IDS|COMMUNITY_COACH_USER_ID|userIdToUse)\s*=\s*['"`]([^'"`]+)['"`]/g;
  while ((match = userIdRegex.exec(seedContent)) !== null) {
    userIds.add(match[1]);
  }
  
  // Array içindeki userId'leri de bul
  const userIdArrayRegex = /['"`]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"`]/gi;
  while ((match = userIdArrayRegex.exec(seedContent)) !== null) {
    userIds.add(match[1]);
  }
  
  console.log(`✅ Seed.ts'de ${titles.size} benzersiz title bulundu`);
  console.log(`✅ Seed.ts'de ${userIds.size} benzersiz userId bulundu`);
  
  return { titles, userIds };
}

function getUserIdVariable(userId: string, seedUserIds: Set<string>): string {
  // Seed.ts'deki sabit userId'leri kontrol et
  const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
  const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
  const COMMUNITY_COACH_USER_ID = '66666666-6666-4666-a666-666666666666';
  
  if (userId === TEST_USER_ID) return 'TEST_USER_ID';
  if (userId === TARGET_USER_ID) return 'TARGET_USER_ID';
  if (userId === COMMUNITY_COACH_USER_ID) return 'COMMUNITY_COACH_USER_ID';
  
  // Trust user ID'leri
  const trustUserIds = [
    '11111111-1111-4111-a111-111111111111',
    '22222222-2222-4222-a222-222222222222',
    '33333333-3333-4333-a333-333333333333',
    '44444444-4444-4444-a444-444444444444',
    '55555555-5555-4555-a555-555555555555',
  ];
  const trustIndex = trustUserIds.indexOf(userId);
  if (trustIndex !== -1) return `TRUST_USER_IDS[${trustIndex}]`;
  
  // Truster user ID'leri
  const trusterUserIds = [
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  ];
  const trusterIndex = trusterUserIds.indexOf(userId);
  if (trusterIndex !== -1) return `TRUSTER_USER_IDS[${trusterIndex}]`;
  
  // Seed userId'lerden biri değilse, userIdToUse kullan veya doğrudan userId string'i kullan
  if (seedUserIds.has(userId)) {
    return `'${userId}'`; // Doğrudan string olarak kullan
  }
  
  return 'userIdToUse'; // Varsayılan
}

function generateSeedCodeForPost(post: PostData, seedUserIds: Set<string>): string {
  const userIdVariable = getUserIdVariable(post.userId, seedUserIds);
  const indent = '    ';
  let code = '';
  
  // Post tipine göre farklı kod üret
  if (post.type === 'QUESTION') {
    code += `${indent}const ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post = await createOrGetContentPost({\n`;
    code += `${indent}  userId: ${userIdVariable},\n`;
    code += `${indent}  type: 'QUESTION',\n`;
    code += `${indent}  title: ${JSON.stringify(post.title)},\n`;
    code += `${indent}  body: ${JSON.stringify(post.body)},\n`;
    if (post.mainCategoryId) code += `${indent}  mainCategoryId: '${post.mainCategoryId}',\n`;
    if (post.subCategoryId) code += `${indent}  subCategoryId: '${post.subCategoryId}',\n`;
    if (post.productGroupId) code += `${indent}  productGroupId: '${post.productGroupId}',\n`;
    if (post.productId) code += `${indent}  productId: '${post.productId}',\n`;
    code += `${indent}  inventoryRequired: ${post.inventoryRequired},\n`;
    code += `${indent}  isBoosted: ${post.isBoosted},\n`;
    if (post.createdAt) code += `${indent}  createdAt: new Date('${post.createdAt.toISOString()}'),\n`;
    code += `${indent}}).catch(() => null)\n\n`;
    
    if (post.question) {
      code += `${indent}if (${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post) {\n`;
      code += `${indent}  const existingQuestion = await prisma.postQuestion.findFirst({\n`;
      code += `${indent}    where: { postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id }\n`;
      code += `${indent}  });\n`;
      code += `${indent}  if (!existingQuestion) {\n`;
      code += `${indent}    await prisma.postQuestion.create({\n`;
      code += `${indent}      data: {\n`;
      code += `${indent}        postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id,\n`;
      code += `${indent}        expectedAnswerFormat: '${post.question.expectedAnswerFormat}',\n`;
      if (post.question.relatedProductId) {
        code += `${indent}        relatedProductId: '${post.question.relatedProductId}',\n`;
      }
      code += `${indent}      },\n`;
      code += `${indent}    });\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n\n`;
    }
  } else if (post.type === 'TIPS') {
    code += `${indent}const ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post = await createOrGetContentPost({\n`;
    code += `${indent}  userId: ${userIdVariable},\n`;
    code += `${indent}  type: 'TIPS',\n`;
    code += `${indent}  title: ${JSON.stringify(post.title)},\n`;
    code += `${indent}  body: ${JSON.stringify(post.body)},\n`;
    if (post.mainCategoryId) code += `${indent}  mainCategoryId: '${post.mainCategoryId}',\n`;
    if (post.subCategoryId) code += `${indent}  subCategoryId: '${post.subCategoryId}',\n`;
    if (post.productGroupId) code += `${indent}  productGroupId: '${post.productGroupId}',\n`;
    if (post.productId) code += `${indent}  productId: '${post.productId}',\n`;
    code += `${indent}  inventoryRequired: ${post.inventoryRequired},\n`;
    code += `${indent}  isBoosted: ${post.isBoosted},\n`;
    if (post.createdAt) code += `${indent}  createdAt: new Date('${post.createdAt.toISOString()}'),\n`;
    code += `${indent}}).catch(() => null)\n\n`;
    
    if (post.tip) {
      code += `${indent}if (${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post) {\n`;
      code += `${indent}  const existingTip = await prisma.postTip.findFirst({\n`;
      code += `${indent}    where: { postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id }\n`;
      code += `${indent}  });\n`;
      code += `${indent}  if (!existingTip) {\n`;
      code += `${indent}    await prisma.postTip.create({\n`;
      code += `${indent}      data: {\n`;
      code += `${indent}        postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id,\n`;
      code += `${indent}        tipCategory: '${post.tip.tipCategory}',\n`;
      code += `${indent}        isVerified: ${post.tip.isVerified},\n`;
      code += `${indent}      },\n`;
      code += `${indent}    });\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n\n`;
    }
    
    if (post.tags && post.tags.length > 0) {
      code += `${indent}if (${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post && ${post.tags.length} > 0) {\n`;
      code += `${indent}  await prisma.contentPostTag.createMany({\n`;
      code += `${indent}    data: ${JSON.stringify(post.tags)}.map((tag) => ({\n`;
      code += `${indent}      postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id,\n`;
      code += `${indent}      tag,\n`;
      code += `${indent}    })),\n`;
      code += `${indent}    skipDuplicates: true,\n`;
      code += `${indent}  });\n`;
      code += `${indent}}\n\n`;
    }
  } else if (post.type === 'COMPARE') {
    code += `${indent}const ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post = await createOrGetContentPost({\n`;
    code += `${indent}  userId: ${userIdVariable},\n`;
    code += `${indent}  type: 'COMPARE',\n`;
    code += `${indent}  title: ${JSON.stringify(post.title)},\n`;
    code += `${indent}  body: ${JSON.stringify(post.body)},\n`;
    if (post.mainCategoryId) code += `${indent}  mainCategoryId: '${post.mainCategoryId}',\n`;
    if (post.subCategoryId) code += `${indent}  subCategoryId: '${post.subCategoryId}',\n`;
    if (post.productGroupId) code += `${indent}  productGroupId: '${post.productGroupId}',\n`;
    if (post.productId) code += `${indent}  productId: '${post.productId}',\n`;
    code += `${indent}  inventoryRequired: ${post.inventoryRequired},\n`;
    code += `${indent}  isBoosted: ${post.isBoosted},\n`;
    if (post.createdAt) code += `${indent}  createdAt: new Date('${post.createdAt.toISOString()}'),\n`;
    code += `${indent}}).catch(() => null)\n\n`;
    
    if (post.comparison) {
      code += `${indent}if (${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post) {\n`;
      code += `${indent}  const existingComparison = await prisma.postComparison.findFirst({\n`;
      code += `${indent}    where: { postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id }\n`;
      code += `${indent}  });\n`;
      code += `${indent}  if (!existingComparison) {\n`;
      code += `${indent}    const comparison = await prisma.postComparison.create({\n`;
      code += `${indent}      data: {\n`;
      code += `${indent}        postId: ${post.id.replace(/[^a-zA-Z0-9]/g, '_')}Post.id,\n`;
      code += `${indent}        product1Id: '${post.comparison.product1Id}',\n`;
      code += `${indent}        product2Id: '${post.comparison.product2Id}',\n`;
      code += `${indent}        comparisonSummary: ${post.comparison.comparisonSummary ? JSON.stringify(post.comparison.comparisonSummary) : 'null'},\n`;
      code += `${indent}      },\n`;
      code += `${indent}    });\n\n`;
      
      if (post.comparison.scores && post.comparison.scores.length > 0) {
        code += `${indent}    for (const score of ${JSON.stringify(post.comparison.scores)}) {\n`;
        code += `${indent}      const existingScore = await prisma.postComparisonScore.findFirst({\n`;
        code += `${indent}        where: {\n`;
        code += `${indent}          comparisonId: comparison.id,\n`;
        code += `${indent}          metricId: score.metricId,\n`;
        code += `${indent}        }\n`;
        code += `${indent}      });\n`;
        code += `${indent}      if (!existingScore) {\n`;
        code += `${indent}        await prisma.postComparisonScore.create({\n`;
        code += `${indent}          data: {\n`;
        code += `${indent}            comparisonId: comparison.id,\n`;
        code += `${indent}            metricId: score.metricId,\n`;
        code += `${indent}            scoreProduct1: score.scoreProduct1,\n`;
        code += `${indent}            scoreProduct2: score.scoreProduct2,\n`;
        if (post.comparison.scores[0].comment) {
          code += `${indent}            comment: score.comment,\n`;
        }
        code += `${indent}          },\n`;
        code += `${indent}        });\n`;
        code += `${indent}      }\n`;
        code += `${indent}    }\n`;
      }
      
      code += `${indent}  }\n`;
      code += `${indent}}\n\n`;
    }
  } else {
    // FREE, EXPERIENCE, UPDATE, vb.
    const postVarName = post.id.replace(/[^a-zA-Z0-9]/g, '_');
    code += `${indent}const ${postVarName}Post = await createOrGetContentPost({\n`;
    code += `${indent}  userId: ${userIdVariable},\n`;
    code += `${indent}  type: '${post.type}',\n`;
    code += `${indent}  title: ${JSON.stringify(post.title)},\n`;
    code += `${indent}  body: ${JSON.stringify(post.body)},\n`;
    if (post.mainCategoryId) code += `${indent}  mainCategoryId: '${post.mainCategoryId}',\n`;
    if (post.subCategoryId) code += `${indent}  subCategoryId: '${post.subCategoryId}',\n`;
    if (post.productGroupId) code += `${indent}  productGroupId: '${post.productGroupId}',\n`;
    if (post.productId) code += `${indent}  productId: '${post.productId}',\n`;
    code += `${indent}  inventoryRequired: ${post.inventoryRequired},\n`;
    code += `${indent}  isBoosted: ${post.isBoosted},\n`;
    if (post.createdAt) code += `${indent}  createdAt: new Date('${post.createdAt.toISOString()}'),\n`;
    code += `${indent}}).catch(() => null)\n\n`;
    
    if (post.tags && post.tags.length > 0) {
      code += `${indent}if (${postVarName}Post) {\n`;
      code += `${indent}  await prisma.contentPostTag.createMany({\n`;
      code += `${indent}    data: ${JSON.stringify(post.tags)}.map((tag) => ({\n`;
      code += `${indent}      postId: ${postVarName}Post.id,\n`;
      code += `${indent}      tag,\n`;
      code += `${indent}    })),\n`;
      code += `${indent}    skipDuplicates: true,\n`;
      code += `${indent}  });\n`;
      code += `${indent}}\n\n`;
    }
  }
  
  return code;
}

async function syncPostsToSeed(dryRun: boolean = false): Promise<void> {
  console.log('🔄 Post senkronizasyonu başlatılıyor...\n');
  
  // Veritabanındaki tüm postları al
  const dbPosts = await getAllPostsFromDatabase();
  console.log(`✅ Veritabanında ${dbPosts.length} post bulundu\n`);
  
  // Seed.ts'deki postları al
  const { titles: seedTitles, userIds: seedUserIds } = await getSeedPosts();
  
  // Seed.ts'de olmayan postları bul (userId bazlı)
  const postsByUserId = new Map<string, PostData[]>();
  
  for (const post of dbPosts) {
    // Seed.ts'de bu title var mı kontrol et
    const existsInSeed = seedTitles.has(post.title);
    
    // Eğer title seed.ts'de yoksa ve userId seed.ts'deki userId'lerden biriyse ekle
    // Veya userId seed.ts'de yoksa da ekle (yeni kullanıcılar için)
    if (!existsInSeed) {
      // userId seed.ts'deki userId'lerden biri mi kontrol et
      const isSeedUserId = seedUserIds.has(post.userId);
      
      // Seed userId'lerden biri ise veya yeni bir userId ise ekle
      if (isSeedUserId || !seedUserIds.has(post.userId)) {
        if (!postsByUserId.has(post.userId)) {
          postsByUserId.set(post.userId, []);
        }
        postsByUserId.get(post.userId)!.push(post);
      }
    }
  }
  
  console.log(`\n📊 Analiz Sonuçları:`);
  console.log(`   - Veritabanındaki toplam post: ${dbPosts.length}`);
  console.log(`   - Seed.ts'deki post sayısı: ${seedTitles.size}`);
  console.log(`   - Seed.ts'de olmayan post sayısı: ${Array.from(postsByUserId.values()).flat().length}`);
  console.log(`   - Farklı kullanıcı sayısı: ${postsByUserId.size}\n`);
  
  if (postsByUserId.size === 0) {
    console.log('✅ Tüm postlar zaten seed.ts\'de mevcut!');
    return;
  }
  
  // Her userId için seed kodu oluştur
  const seedCodeByUserId = new Map<string, string>();
  
  for (const [userId, posts] of postsByUserId.entries()) {
    console.log(`\n👤 Kullanıcı ${userId} için ${posts.length} post bulundu`);
    
    let userSeedCode = `\n  // ===== USER ID: ${userId} =====\n`;
    userSeedCode += `  // ${posts.length} post seed.ts'ye eklenecek\n\n`;
    
    for (const post of posts) {
      userSeedCode += generateSeedCodeForPost(post, seedUserIds);
    }
    
    seedCodeByUserId.set(userId, userSeedCode);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - Seed kodu oluşturuldu (dosyaya yazılmadı):\n');
    for (const [userId, code] of seedCodeByUserId.entries()) {
      console.log(`\n--- USER ID: ${userId} ---`);
      console.log(code);
    }
    console.log('\n💡 Gerçek ekleme için --dry-run parametresini kaldırın');
    return;
  }
  
  // Seed.ts dosyasına ekle
  const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
  const seedContent = fs.readFileSync(seedPath, 'utf-8');
  
  // main() fonksiyonunun sonuna ekle (markSeedEnd() çağrısından önce)
  const markSeedEndIndex = seedContent.lastIndexOf('markSeedEnd()');
  
  if (markSeedEndIndex === -1) {
    console.error('❌ markSeedEnd() bulunamadı, seed.ts dosyasına manuel ekleme yapılmalı');
    return;
  }
  
  // Tüm kullanıcılar için seed kodunu birleştir
  let allSeedCode = '\n  // ===== VERİTABANINDAN EKLENEN POSTLAR =====\n';
  allSeedCode += `  // ${Array.from(postsByUserId.values()).flat().length} post veritabanından seed.ts'ye eklendi\n`;
  allSeedCode += `  // Tarih: ${new Date().toISOString()}\n\n`;
  
  for (const [userId, code] of seedCodeByUserId.entries()) {
    allSeedCode += code;
  }
  
  // Seed.ts dosyasına ekle
  const newSeedContent = 
    seedContent.slice(0, markSeedEndIndex) + 
    allSeedCode + 
    '\n  ' + 
    seedContent.slice(markSeedEndIndex);
  
  // Backup oluştur
  const backupPath = path.join(process.cwd(), 'prisma', `seed.ts.backup.${Date.now()}`);
  fs.writeFileSync(backupPath, seedContent, 'utf-8');
  console.log(`\n💾 Backup oluşturuldu: ${backupPath}`);
  
  // Yeni içeriği yaz
  fs.writeFileSync(seedPath, newSeedContent, 'utf-8');
  console.log(`\n✅ ${Array.from(postsByUserId.values()).flat().length} post seed.ts dosyasına eklendi!`);
  console.log(`📁 Dosya: ${seedPath}`);
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

syncPostsToSeed(dryRun)
  .catch((e) => {
    console.error('❌ Senkronizasyon hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

