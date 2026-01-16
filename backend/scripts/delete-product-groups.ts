/**
 * Product Group ve İlişkili Verileri Silme Script'i
 * 
 * Belirtilen product group'ları ve bunlara ait:
 * - Product'ları
 * - Product'lara ait post'ları
 * - Product group'a direkt bağlı post'ları
 * - Tüm ilişkili verileri (likes, comments, media, vb.)
 * siler.
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

// Silinecek product group ID'leri
const PRODUCT_GROUP_IDS = [
  '75f62658-c2f2-4107-b83d-e93f9d95089b',
  '31c92d37-000c-452e-bae7-22b87a8abc0b',
  'f3565530-42a8-4c70-881e-f085d82b2ba1',
  'b8ba8c0e-6811-4cb7-b3f3-a2572d37097d',
  'ffeb0382-d8b0-4568-9192-c6b11dcf6d1b',
  '69e6edf9-87e6-4417-9731-5871558760ae',
  'b6014ee8-2ed9-4c85-a031-413d4a8977c4',
  'bd1f8f0a-3f4e-4f36-9125-086938d5677c',
  'aeecdf43-6b5d-48b5-8e32-09c3d61ceb76',
  '0d39f227-547b-47d4-9cbe-e04e1794962c',
  'e679ecab-f23c-42fe-93ab-4ec5855b9ea2',
  'c6e9424d-ace1-4a90-9054-e86573aebd2f',
  '7310769b-ce21-4abc-93f7-d482da5d1f4b',
  'ad209626-5ba6-4ae8-a23a-d81043435eba',
  '42903f2e-70e2-41b4-b355-9f3b003f06e6',
  '1d6844a3-5c77-46ca-8a5d-ccf4f1744f76',
  '54bc9f27-3da2-4034-ab3f-2d3340908216',
  '578187bb-b0be-4b7a-831c-97d20671294f',
  'e087c002-6d47-4036-9de9-dab389a91e49',
  'b59fe1dc-898f-49bd-ba74-cc5d89e40d64',
  '2bf345e6-0e29-4a29-955e-efdd00d6066f',
  'b9666095-bf9b-449c-aa63-3cdb0eb8825e',
  '6954e46c-47a4-495d-b41c-4f87163d8378',
  '472658d2-0c04-46ab-a915-4890d1e06297',
  '8e43b890-4720-4712-a814-d0588d7ea491',
  'd665bc14-e638-4112-80b6-f012a79bb4f6',
  '21872a47-94b1-4b73-8550-a80aecc09ad1',
  '4b7f01e9-db18-4cca-adfa-9da2aa686707',
  '7f9c0b1d-a8e8-42ae-b949-09cdb9e51522',
  'e1fc395e-9a46-4ea9-9f71-ce93fea8ba52',
];

async function deleteProductGroups(dryRun: boolean = false): Promise<void> {
  try {
    console.log(`🔍 ${PRODUCT_GROUP_IDS.length} product group kontrol ediliyor...\n`);

    // Product group'ları kontrol et
    const productGroups = await prisma.productGroup.findMany({
      where: { id: { in: PRODUCT_GROUP_IDS } },
      select: { id: true, name: true },
    });

    if (productGroups.length === 0) {
      console.log('⚠️  Hiçbir product group bulunamadı!\n');
      return;
    }

    console.log(`📊 ${productGroups.length} product group bulundu:\n`);
    productGroups.forEach((pg) => {
      console.log(`   - ${pg.id}: ${pg.name}`);
    });
    console.log('');

    // Product group'lara ait product'ları bul
    const products = await prisma.product.findMany({
      where: { groupId: { in: PRODUCT_GROUP_IDS } },
      select: { id: true, name: true, groupId: true },
    });

    console.log(`📦 ${products.length} product bulundu\n`);

    const productIds = products.map((p) => p.id);

    // Product'lara ait post'ları bul
    const productPosts = await prisma.contentPost.findMany({
      where: { productId: { in: productIds } },
      select: { id: true },
    });

    // Product group'a direkt bağlı post'ları bul
    const productGroupPosts = await prisma.contentPost.findMany({
      where: { productGroupId: { in: PRODUCT_GROUP_IDS } },
      select: { id: true },
    });

    const allPostIds = [
      ...productPosts.map((p) => p.id),
      ...productGroupPosts.map((p) => p.id),
    ];

    console.log(`📝 ${allPostIds.length} post bulundu (${productPosts.length} product post + ${productGroupPosts.length} product group post)\n`);

    if (dryRun) {
      console.log('🔍 [DRY RUN] Silinecek veriler:');
      console.log(`   - ${productGroups.length} product group`);
      console.log(`   - ${products.length} product`);
      console.log(`   - ${allPostIds.length} post`);
      console.log('\n⚠️  DRY RUN modu - Hiçbir şey silinmedi');
      console.log('💡 Gerçekten silmek için: npx ts-node scripts/delete-product-groups.ts --execute\n');
      return;
    }

    console.log('⚠️  GERÇEK SİLME İŞLEMİ BAŞLIYOR...\n');
    console.log('5 saniye bekleniyor... (Ctrl+C ile iptal edebilirsiniz)');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Post'lara ait ilişkili verileri sil
    if (allPostIds.length > 0) {
      console.log('🗑️  Post ilişkili verileri siliniyor...');
      
      await prisma.contentPostTag.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.postTag.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.contentLike.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.contentCommentVote.deleteMany({
        where: { comment: { postId: { in: allPostIds } } },
      });
      await prisma.contentComment.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.contentFavorite.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.contentShare.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.contentPostView.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.postMedia.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.postComparisonScore.deleteMany({
        where: { comparison: { postId: { in: allPostIds } } },
      });
      await prisma.postComparison.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.postQuestion.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.postTip.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.topCommunityChoice.deleteMany({
        where: { postId: { in: allPostIds } },
      });

      // Feed'den de sil
      await prisma.feed.deleteMany({
        where: { postId: { in: allPostIds } },
      });
      await prisma.trendingPost.deleteMany({
        where: { postId: { in: allPostIds } },
      });

      console.log('   ✅ Post ilişkili verileri silindi');
    }

    // Post'ları sil
    if (allPostIds.length > 0) {
      console.log('🗑️  Post\'lar siliniyor...');
      await prisma.contentPost.deleteMany({
        where: { id: { in: allPostIds } },
      });
      console.log(`   ✅ ${allPostIds.length} post silindi`);
    }

    // Product'lara ait inventory'leri kontrol et ve sil
    if (productIds.length > 0) {
      console.log('🗑️  Product inventory\'leri kontrol ediliyor...');
      const inventories = await prisma.inventory.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      });

      if (inventories.length > 0) {
        const inventoryIds = inventories.map((i) => i.id);
        
        // Inventory media'ları sil
        await prisma.inventoryMedia.deleteMany({
          where: { inventoryId: { in: inventoryIds } },
        });

        // Inventory'leri sil
        await prisma.inventory.deleteMany({
          where: { id: { in: inventoryIds } },
        });
        
        console.log(`   ✅ ${inventories.length} inventory silindi`);
      } else {
        console.log('   ℹ️  Inventory bulunamadı');
      }
    }

    // Product suggestion'lar product'a direkt bağlı değil, silmeye gerek yok

    // Product'ları sil
    if (products.length > 0) {
      console.log('🗑️  Product\'lar siliniyor...');
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
      console.log(`   ✅ ${products.length} product silindi`);
    }

    // Product group'ları sil
    console.log('🗑️  Product group\'lar siliniyor...');
    await prisma.productGroup.deleteMany({
      where: { id: { in: PRODUCT_GROUP_IDS } },
    });
    console.log(`   ✅ ${productGroups.length} product group silindi`);

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ÖZET:`);
    console.log(`   - Silinen Product Group: ${productGroups.length}`);
    console.log(`   - Silinen Product: ${products.length}`);
    console.log(`   - Silinen Post: ${allPostIds.length}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Tüm veriler başarıyla silindi!\n');
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
    console.log('⚠️  GERÇEK SİLME MODU - Veriler silinecek!\n');
  }

  await deleteProductGroups(dryRun);
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

export { deleteProductGroups };
