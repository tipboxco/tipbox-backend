/**
 * Path'i tam URL'ye çeviren script
 * Kullanım: npx tsx scripts/get-media-url.ts "posts/99999999-9999-4999-9999-999999999999/00MJA2SSP800000ME7HYXX17RI/image-0.jpg"
 */

import { buildMediaUrl, resolveMediaUrl, getPublicMediaBaseUrl } from '../src/infrastructure/config/media.config';
import { s3Config } from '../src/infrastructure/config/s3.config';

const mediaPath = process.argv[2];

if (!mediaPath) {
  console.error('❌ Kullanım: npx tsx scripts/get-media-url.ts "posts/.../image-0.jpg"');
  process.exit(1);
}

console.log('\n📸 Media URL Dönüşümü\n');
console.log('─'.repeat(80));
console.log(`📁 Path (DB'deki):`);
console.log(`   ${mediaPath}\n`);

const fullUrl = resolveMediaUrl(mediaPath);
const publicBase = getPublicMediaBaseUrl();

console.log(`🌐 Tam URL (Backend API üzerinden - /media/ route'u gerekli):`);
console.log(`   ${fullUrl}\n`);

console.log(`🔗 Direkt MinIO Erişimi (Tarayıcıda açılabilir):`);
console.log(`   ${publicBase}/${s3Config.bucketName}/${mediaPath}\n`);

console.log('─'.repeat(80));
console.log('\n💡 Notlar:');
console.log('   - Backend API URL: Backend\'de /media/ route\'u varsa çalışır');
console.log('   - Direkt MinIO URL: MinIO bucket public ise çalışır');
console.log('   - Development: http://localhost:9000/tipbox-media/...');
console.log('   - Production: http://api-test.tipbox.co:9000/tipbox-media/...\n');






