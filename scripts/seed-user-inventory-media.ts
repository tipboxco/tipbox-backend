/**
 * Belirli bir kullanıcının tüm inventory kayıtları için
 * `tests/assets/product` altındaki görselleri MinIO'ya yükler
 * ve `inventory_media` tablosuna IMAGE kaydı ekler.
 *
 * Kullanım:
 *   npx ts-node scripts/seed-user-inventory-media.ts <userId>
 */

process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
process.env.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'tipbox-media';
process.env.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
process.env.S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';

import { PrismaClient, InventoryMediaType } from '@prisma/client';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';

const USER_ID = process.argv[2];

if (!USER_ID) {
  console.error('Kullanım: npx ts-node scripts/seed-user-inventory-media.ts <userId>');
  process.exit(1);
}

const ASSETS_DIR = path.resolve(__dirname, '../tests/assets/product');

async function main() {
  const prisma = new PrismaClient();
  const s3 = new S3Service();

  console.log(`🔍 Kullanıcı inventory kayıtları alınıyor... (${USER_ID})`);
  const inventories = await prisma.inventory.findMany({
    where: { userId: USER_ID },
    select: { id: true, productId: true },
  });

  if (!inventories.length) {
    console.log('Bu kullanıcı için inventory kaydı bulunamadı.');
    await prisma.$disconnect();
    return;
  }

  const files = readdirSync(ASSETS_DIR).filter((f) =>
    /\.(png|jpg|jpeg|gif|webp)$/i.test(f)
  );

  if (!files.length) {
    console.error(`Asset klasöründe görsel bulunamadı: ${ASSETS_DIR}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`🖼  ${files.length} adet asset bulundu, MinIO'ya yüklenecek...`);

  let uploadCount = 0;

  for (const inv of inventories) {
    // Her inventory için rastgele bir görsel seç
    const fileName = files[Math.floor(Math.random() * files.length)];
    const fullPath = path.join(ASSETS_DIR, fileName);

    const buffer = readFileSync(fullPath);
    const ext = path.extname(fullPath).replace('.', '').toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';

    const objectKey = `posts/${USER_ID}/${Date.now()}-${path.basename(fullPath)}`;

    const url = await s3.uploadFile(objectKey, buffer, contentType);

    await prisma.inventoryMedia.create({
      data: {
        inventoryId: inv.id,
        mediaUrl: url,
        type: InventoryMediaType.IMAGE,
      },
    });

    uploadCount += 1;
    console.log(`✅ Inventory ${inv.id} için görsel yüklendi: ${url}`);
  }

  console.log(`🎉 Toplam ${uploadCount} adet inventory media kaydı oluşturuldu.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});


