import dotenv from 'dotenv';
dotenv.config();

import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import logger from '../src/infrastructure/logger/logger';
import { DEFAULT_AVATAR_PATH } from '../src/infrastructure/config/media.config';

const s3Service = new S3Service();

/**
 * Default avatar'ı MinIO'ya yükle
 * Bu avatar tüm ortamlarda (dev, test, prod) kullanılacak
 * Avatar null olan tüm kullanıcılar için fallback olarak gösterilecek
 */
async function uploadDefaultAvatar(): Promise<void> {
  try {
    console.log('🚀 Default avatar yükleme işlemi başlatılıyor...\n');
    
    // MinIO bucket'ını kontrol et
    await s3Service.checkAndCreateBucket();
    console.log('✅ MinIO bucket hazır\n');
    
    // Default avatar dosyasının yolu
    const defaultAvatarFilePath = path.join(
      __dirname, 
      '../tests/assets/defaultavatar/default-useravatar.png'
    );
    
    // Dosya kontrolü
    if (!existsSync(defaultAvatarFilePath)) {
      throw new Error(`Default avatar dosyası bulunamadı: ${defaultAvatarFilePath}`);
    }
    
    console.log(`📁 Dosya bulundu: ${defaultAvatarFilePath}`);
    
    // Dosyayı oku
    const fileBuffer = readFileSync(defaultAvatarFilePath);
    console.log(`📦 Dosya boyutu: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    // MinIO'ya yükle
    console.log(`📤 MinIO'ya yükleniyor: ${DEFAULT_AVATAR_PATH}`);
    const uploadedPath = await s3Service.uploadFile(
      DEFAULT_AVATAR_PATH,
      fileBuffer,
      'image/png'
    );
    
    console.log(`✅ MinIO'ya yüklendi: ${uploadedPath}`);
    console.log(`\n🎉 Default avatar başarıyla yüklendi!`);
    console.log(`\n📝 Kullanım: Avatar null olan tüm kullanıcılar için bu görsel gösterilecek`);
    console.log(`   Path: ${DEFAULT_AVATAR_PATH}`);
    
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    logger.error('Error uploading default avatar:', error);
    throw error;
  }
}

uploadDefaultAvatar();

