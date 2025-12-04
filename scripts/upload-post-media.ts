/**
 * Basit CLI: tests/assets içindeki görselleri MinIO'ya yükler ve URL döner.
 *
 * Kullanım:
 *   npx ts-node scripts/upload-post-media.ts tests/assets/product/phone1.png
 */

process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
process.env.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'tipbox-media';
process.env.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
process.env.S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';

import { readFileSync } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';

const filePath = process.argv[2];
const prefix = process.argv[3] || 'test-posts';

if (!filePath) {
  console.error('Kullanım: npx ts-node scripts/upload-post-media.ts <dosyaYolu> [klasor]');
  process.exit(1);
}

async function main() {
  const s3 = new S3Service();
  const buffer = readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const contentType = mimeMap[ext] || 'image/jpeg';
  const fileName = `${prefix}/${Date.now()}-${path.basename(filePath)}`;
  const url = await s3.uploadFile(fileName, buffer, contentType);
  console.log(url);
}

main().catch((error) => {
  console.error('Upload başarısız:', error);
  process.exit(1);
});









