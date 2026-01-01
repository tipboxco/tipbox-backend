import dotenv from 'dotenv';
dotenv.config();

import { S3Service } from '../src/infrastructure/s3/s3.service';
import { PutBucketPolicyCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';
import { s3Config } from '../src/infrastructure/config/s3.config';
import logger from '../src/infrastructure/logger/logger';

const s3Service = new S3Service();

async function fixBucketPolicy() {
  try {
    console.log('🔍 MinIO bucket policy kontrol ediliyor...');
    console.log(`   Bucket: ${s3Config.bucketName}`);
    console.log(`   Endpoint: ${s3Config.endpoint}\n`);

    // Mevcut policy'yi kontrol et
    try {
      const getPolicyCommand = new GetBucketPolicyCommand({
        Bucket: s3Config.bucketName,
      });
      
      const currentPolicy = await s3Service['s3Client'].send(getPolicyCommand);
      console.log('📋 Mevcut bucket policy:');
      console.log(JSON.stringify(JSON.parse(currentPolicy.Policy || '{}'), null, 2));
      console.log('');
    } catch (error: any) {
      if (error.name === 'NoSuchBucketPolicy' || error.Code === 'NoSuchBucketPolicy') {
        console.log('⚠️  Bucket policy bulunamadı, yeni policy eklenecek\n');
      } else {
        console.log(`⚠️  Policy okuma hatası: ${error.message}\n`);
      }
    }

    // Public read policy oluştur
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${s3Config.bucketName}/*`,
        },
      ],
    };

    console.log('📝 Yeni bucket policy ayarlanıyor...');
    console.log(JSON.stringify(policy, null, 2));
    console.log('');

    const putPolicyCommand = new PutBucketPolicyCommand({
      Bucket: s3Config.bucketName,
      Policy: JSON.stringify(policy),
    });

    await s3Service['s3Client'].send(putPolicyCommand);

    console.log('✅ Bucket policy başarıyla ayarlandı!');
    console.log('\n📋 Policy detayları:');
    console.log(`   Bucket: ${s3Config.bucketName}`);
    console.log(`   Action: s3:GetObject`);
    console.log(`   Resource: arn:aws:s3:::${s3Config.bucketName}/*`);
    console.log(`   Principal: * (herkes)`);
    console.log('\n✅ Artık tüm dosyalar public olarak erişilebilir!');

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Error fixing bucket policy:', error);
    
    if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
      console.log('\n💡 Çözüm önerileri:');
      console.log('   1. MinIO Console\'a gidin: http://localhost:9001');
      console.log('   2. Buckets → tipbox-media → Access Policy');
      console.log('   3. Policy\'yi manuel olarak ayarlayın:');
      console.log(JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${s3Config.bucketName}/*`,
        }],
      }, null, 2));
    }
  }
}

fixBucketPolicy();

