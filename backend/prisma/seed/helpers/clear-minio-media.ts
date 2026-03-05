/**
 * MinIO görsel temizleme fonksiyonları
 * 
 * Seed mekanizmasına uyumlu olarak:
 * - clearUserContentMedia(): User/content görsellerini temizle (taxonomy korunur)
 * - clearAllMedia(): Tüm görselleri temizle (taxonomy dahil)
 */

import { S3Service } from '../../../src/infrastructure/s3/s3.service';

/**
 * User/Content görsellerini temizle (taxonomy korunur)
 * 
 * Temizlenen klasörler:
 * - users/ (user avatarları, bannerlar)
 * - posts/ (post görselleri)
 * - post-media/ (post media klasörü)
 * - inventory/ (inventory görselleri)
 * - news/ (news görselleri)
 * - profile-pictures/ (profile pictures - user bazlı)
 * - profile-banners/ (profile banners - user bazlı)
 * 
 * Korunan klasörler (taxonomy):
 * - catalog/ (kategori görselleri)
 * - brand-categories/ (brand kategori görselleri)
 * - badges/custom/ (badge görselleri)
 * - products/ (ürün görselleri - sabit olanlar)
 * - brands/catalog/ (brand görselleri)
 * - event/ (event görselleri)
 */
export async function clearUserContentMedia(): Promise<void> {
  console.log('🧹 MinIO user/content görselleri temizleniyor (taxonomy korunuyor)...\n');

  const s3Service = new S3Service();
  await s3Service.checkAndCreateBucket();

  const foldersToClear = [
    'users/',
    'posts/',
    'post-media/',
    'inventory/',
    'news/',
    'profile-pictures/',
    'profile-banners/',
  ];

  let totalDeleted = 0;

  for (const folder of foldersToClear) {
    try {
      const deleted = await s3Service.deleteFolder(folder);
      if (deleted > 0) {
        console.log(`  ✅ ${folder}: ${deleted} dosya silindi`);
        totalDeleted += deleted;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`  ⚠️  ${folder} temizlenirken hata: ${errorMsg}`);
    }
  }

  if (totalDeleted > 0) {
    console.log(`\n✅ Toplam ${totalDeleted} user/content görseli temizlendi`);
    console.log('✅ Taxonomy görselleri korundu (catalog, brand-categories, badges, products, brands, event)\n');
  } else {
    console.log('ℹ️  Temizlenecek user/content görseli bulunamadı\n');
  }
}

/**
 * Tüm görselleri temizle (taxonomy dahil)
 * 
 * NOT: Bu fonksiyon tüm bucket içeriğini siler!
 * Sadece seed:all komutunda kullanılmalıdır.
 */
export async function clearAllMedia(): Promise<void> {
  console.log('🧹 MinIO TÜM görselleri temizleniyor (taxonomy dahil)...\n');

  const s3Service = new S3Service();
  await s3Service.checkAndCreateBucket();

  try {
    // Tüm bucket içeriğini sil
    const deleted = await s3Service.clearBucket();
    
    if (deleted > 0) {
      console.log(`✅ Toplam ${deleted} görsel silindi (tüm bucket temizlendi)\n`);
    } else {
      console.log('ℹ️  Bucket zaten boş\n');
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ MinIO temizleme hatası: ${errorMsg}`);
    throw error;
  }
}

