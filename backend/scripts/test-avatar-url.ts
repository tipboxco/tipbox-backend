import dotenv from 'dotenv';
dotenv.config();

import { buildMediaUrl } from '../src/infrastructure/config/media.config';
import { s3Config } from '../src/infrastructure/config/s3.config';

const testPaths = [
  'profile-pictures/22222222-2222-4222-a222-222222222222/useravatar3.jpg',
  'profile-pictures/248cc91f-b551-4ecc-a885-db1163571330/seed-avatar.jpg',
  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg',
];

console.log('🔍 Avatar URL formatları test ediliyor...\n');
console.log(`Bucket: ${s3Config.bucketName}`);
console.log(`Endpoint: ${process.env.S3_ENDPOINT || 'http://minio:9000'}\n`);

testPaths.forEach((path, index) => {
  const url = buildMediaUrl(path);
  console.log(`${index + 1}. Path: ${path}`);
  console.log(`   URL: ${url}`);
  console.log(`   ✅ Doğru format: http://[endpoint]/${s3Config.bucketName}/${path}\n`);
});

console.log('📝 Önemli Notlar:');
console.log('   - MinIO URL formatı: http://[endpoint]/[bucket-name]/[object-key]');
console.log('   - Bucket name: tipbox-media');
console.log('   - Object key: profile-pictures/...');
console.log('   - Yanlış format: http://localhost:9000/profile-pictures/... (bucket name eksik!)');
console.log('   - Doğru format: http://localhost:9000/tipbox-media/profile-pictures/...');

