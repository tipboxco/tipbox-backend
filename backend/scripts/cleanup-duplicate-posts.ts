/**
 * Duplicate Post Temizleme Script'i
 * 
 * Aynı contextType, contextId ve type'a sahip duplicate post'ları temizler.
 * En yeni post'u bırakıp, eskilerini siler.
 */

import { PrismaClient, ContentPostType } from '@prisma/client';

const prisma = new PrismaClient();

interface DuplicateGroup {
  contextType: string;
  contextId: string;
  type: ContentPostType;
  posts: Array<{ id: string; createdAt: Date }>;
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log('🔍 Duplicate postlar araniyor...\n');

  // Tüm post'ları al
  const allPosts = await prisma.contentPost.findMany({
    select: {
      id: true,
      type: true,
      subCategoryId: true,
      productGroupId: true,
      productId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Context type'ı belirle
  const postsWithContext = allPosts.map((post) => {
    let contextType: string;
    let contextId: string;

    if (post.productId) {
      contextType = 'product';
      contextId = post.productId;
    } else if (post.productGroupId) {
      contextType = 'product_group';
      contextId = post.productGroupId;
    } else if (post.subCategoryId) {
      contextType = 'sub_category';
      contextId = post.subCategoryId;
    } else {
      return null;
    }

    return {
      id: post.id,
      type: post.type,
      contextType,
      contextId,
      createdAt: post.createdAt,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  // Duplicate'leri grupla
  const duplicateMap = new Map<string, DuplicateGroup>();

  for (const post of postsWithContext) {
    const key = `${post.contextType}:${post.contextId}:${post.type}`;
    
    if (!duplicateMap.has(key)) {
      duplicateMap.set(key, {
        contextType: post.contextType,
        contextId: post.contextId,
        type: post.type,
        posts: [],
      });
    }

    duplicateMap.get(key)!.posts.push({
      id: post.id,
      createdAt: post.createdAt,
    });
  }

  // Sadece 1'den fazla post'u olan grupları filtrele
  const duplicates = Array.from(duplicateMap.values()).filter(
    (group) => group.posts.length > 1
  );

  return duplicates;
}

async function cleanupDuplicates(dryRun: boolean = false): Promise<void> {
  try {
    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
      console.log('✅ Duplicate post bulunamadı!\n');
      return;
    }

    console.log(`📊 ${duplicates.length} duplicate grup bulundu\n`);

    let totalToDelete = 0;
    let totalToKeep = 0;

    for (const group of duplicates) {
      // En yeni post'u bırak, diğerlerini sil
      const sortedPosts = group.posts.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const toKeep = sortedPosts[0];
      const toDelete = sortedPosts.slice(1);

      totalToKeep += 1;
      totalToDelete += toDelete.length;

      if (!dryRun) {
        console.log(
          `🗑️  ${group.contextType} (${group.contextId}) - ${group.type}:`
        );
        console.log(`   ✅ Tutulacak: ${toKeep.id} (${toKeep.createdAt.toISOString()})`);
        console.log(`   ❌ Silinecek: ${toDelete.length} post`);

          // İlişkili verileri de sil
          for (const post of toDelete) {
            // İlişkili tabloları temizle (cascade delete zaten var ama manuel de silebiliriz)
            await prisma.contentPostTag.deleteMany({
              where: { postId: post.id },
            });
            await prisma.postTag.deleteMany({
              where: { postId: post.id },
            });
            await prisma.contentLike.deleteMany({
              where: { postId: post.id },
            });
            await prisma.contentComment.deleteMany({
              where: { postId: post.id },
            });
            await prisma.contentFavorite.deleteMany({
              where: { postId: post.id },
            });
            await prisma.postMedia.deleteMany({
              where: { postId: post.id },
            });
            await prisma.postComparison.deleteMany({
              where: { postId: post.id },
            });
            await prisma.postQuestion.deleteMany({
              where: { postId: post.id },
            });
            await prisma.postTip.deleteMany({
              where: { postId: post.id },
            });

          // Post'u sil (cascade delete ile ilişkili veriler otomatik silinir)
          await prisma.contentPost.delete({
            where: { id: post.id },
          });
        }
      } else {
        console.log(
          `🔍 [DRY RUN] ${group.contextType} (${group.contextId}) - ${group.type}:`
        );
        console.log(`   ✅ Tutulacak: ${toKeep.id} (${toKeep.createdAt.toISOString()})`);
        console.log(`   ❌ Silinecek: ${toDelete.length} post`);
        toDelete.forEach((p) => {
          console.log(`      - ${p.id} (${p.createdAt.toISOString()})`);
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ÖZET:`);
    console.log(`   - Toplam Duplicate Grup: ${duplicates.length}`);
    console.log(`   - Tutulacak Post: ${totalToKeep}`);
    console.log(`   - Silinecek Post: ${totalToDelete}`);
    console.log('='.repeat(60) + '\n');

    if (dryRun) {
      console.log('⚠️  DRY RUN modu - Hiçbir şey silinmedi');
      console.log('💡 Gerçekten silmek için: npx ts-node scripts/cleanup-duplicate-posts.ts --execute\n');
    } else {
      console.log('✅ Duplicate postlar basariyla temizlendi!\n');
    }
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    console.error(error.stack);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  if (dryRun) {
    console.log('🔍 DRY RUN MODU - Hiçbir şey silinmeyecek\n');
  } else {
    console.log('⚠️  GERÇEK SİLME MODU - Postlar silinecek!\n');
    console.log('5 saniye bekleniyor... (Ctrl+C ile iptal edebilirsiniz)');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  await cleanupDuplicates(dryRun);
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('\n❌ Script hata ile sonlandı:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { cleanupDuplicates };
