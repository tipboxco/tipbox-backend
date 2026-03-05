/**
 * MinIO görsel temizleme fonksiyonları
 * 
 * Seed mekanizmasına uyumlu olarak:
 * - clearUserContentMedia(): User/content görsellerini temizle (taxonomy korunur)
 * - clearAllMedia(): Tüm görselleri temizle (taxonomy dahil)
 */

import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { SeedPipelineLogger } from './seed-pipeline-logger';

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
  const foldersToClear = [
    'users/',
    'posts/',
    'post-media/',
    'inventory/',
    'news/',
    'profile-pictures/',
    'profile-banners/',
  ];

  const pipeline = new SeedPipelineLogger('clearUserContentMedia', foldersToClear.length + 1);

  try {
    // [1] Ensure bucket exists
    const s3Service = await pipeline.runStage('Ensure MinIO bucket', async () => {
      const svc = new S3Service();
      await svc.checkAndCreateBucket();
      return svc;
    });

    // [2..8] Clear each folder
    let totalDeleted = 0;
    for (const folder of foldersToClear) {
      await pipeline.runStageOptional(
        `Clear ${folder}`,
        async () => {
          const deleted = await s3Service.deleteFolder(folder);
          totalDeleted += deleted;
        },
        undefined,
      );
    }

    pipeline.complete(`${totalDeleted} files deleted, taxonomy preserved`);
  } catch (error) {
    pipeline.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Tüm görselleri temizle (taxonomy dahil)
 * 
 * NOT: Bu fonksiyon tüm bucket içeriğini siler!
 * Sadece seed:all komutunda kullanılmalıdır.
 */
export async function clearAllMedia(): Promise<void> {
  const pipeline = new SeedPipelineLogger('clearAllMedia', 2);

  try {
    const s3Service = await pipeline.runStage('Ensure MinIO bucket', async () => {
      const svc = new S3Service();
      await svc.checkAndCreateBucket();
      return svc;
    });

    const deleted = await pipeline.runStage('Clear entire bucket', () =>
      s3Service.clearBucket(),
    );

    pipeline.complete(`${deleted} files deleted`);
  } catch (error) {
    pipeline.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

