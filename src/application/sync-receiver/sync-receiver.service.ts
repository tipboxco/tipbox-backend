import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import {
  SyncPayload,
  SyncRecord,
  ProcessResult,
  ProcessedRecord,
  SyncModuleType,
} from '../../interfaces/sync-receiver/sync-receiver.dto';

export class SyncReceiverService {
  private prisma = getPrisma();

  /**
   * Gelen sync batch'ini modül tipine göre işler
   */
  async processSyncBatch(payload: SyncPayload): Promise<ProcessResult> {
    const { module_type, data } = payload;

    switch (module_type) {
      case 'brand':
        return this.processBrandBatch(data);
      case 'category':
        return this.processCategoryBatch(data);
      case 'product':
        return this.processProductBatch(data);
      default:
        throw new Error(`Unsupported module type: ${module_type}`);
    }
  }

  /**
   * Brand verilerini batch olarak işler (upsert) - Optimized for high traffic
   */
  private async processBrandBatch(data: SyncRecord[]): Promise<ProcessResult> {
    if (data.length === 0) {
      return { processed: 0, failed: 0, created: 0, updated: 0, records: [] };
    }

    const records: ProcessedRecord[] = [];
    const recordIds = data.map((r) => r.id);

    // Tüm ID'leri bir kerede çek
    const existingBrands = await this.prisma.brand.findMany({
      where: { id: { in: recordIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingBrands.map((b) => b.id));
    const toCreate: typeof data = [];
    const toUpdate: typeof data = [];

    // Kayıtları create ve update listelerine ayır
    for (const record of data) {
      if (existingIds.has(record.id)) {
        toUpdate.push(record);
      } else {
        toCreate.push(record);
      }
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    // Transaction içinde batch işlemler
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Batch create
          if (toCreate.length > 0) {
            const createData = toCreate.map((record) => ({
              id: record.id,
              name: record.name || record.title || 'Unnamed Brand',
              description: record.description || null,
              logoUrl: record.logo_url || record.image_url || null,
              imageUrl: record.image_url || record.logo_url || null,
              category: (record.category as string) || null,
              categoryId: record.category_id || null,
            }));

            // Prisma createMany skipDuplicates kullanarak hızlı insert
            await tx.brand.createMany({
              data: createData,
              skipDuplicates: true,
            });

            created = toCreate.length;
            toCreate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'created',
              });
            });
          }

          // Batch update - her kayıt için ayrı update (Prisma updateMany where in desteklemiyor)
          if (toUpdate.length > 0) {
            // Paralel update işlemleri için Promise.all kullan
            const updatePromises = toUpdate.map((record) =>
              tx.brand.update({
                where: { id: record.id },
                data: {
                  name: record.name || record.title || 'Unnamed Brand',
                  description: record.description || null,
                  logoUrl: record.logo_url || record.image_url || null,
                  imageUrl: record.image_url || record.logo_url || null,
                  category: (record.category as string) || null,
                  categoryId: record.category_id || null,
                },
              }),
            );

            await Promise.all(updatePromises);
            updated = toUpdate.length;
            toUpdate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'updated',
              });
            });
          }
        },
        {
          timeout: 30000, // 30 saniye timeout
        },
      );
    } catch (error) {
      // Transaction başarısız olursa, her kaydı tek tek dene
      logger.warn('[SyncReceiver] Batch transaction failed, falling back to individual upserts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.processBrandBatchFallback(data);
    }

    return {
      processed: created + updated,
      failed,
      created,
      updated,
      records,
    };
  }

  /**
   * Brand batch işlemi için fallback - transaction başarısız olursa kullanılır
   */
  private async processBrandBatchFallback(data: SyncRecord[]): Promise<ProcessResult> {
    const records: ProcessedRecord[] = [];
    let processed = 0;
    let failed = 0;
    let created = 0;
    let updated = 0;

    for (const record of data) {
      try {
        const brandData = {
          name: record.name || record.title || 'Unnamed Brand',
          description: record.description || null,
          logoUrl: record.logo_url || record.image_url || null,
          imageUrl: record.image_url || record.logo_url || null,
          category: (record.category as string) || null,
          categoryId: record.category_id || null,
        };

        // Önce var mı kontrol et
        const existing = await this.prisma.brand.findUnique({
          where: { id: record.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.brand.update({
            where: { id: record.id },
            data: brandData,
          });
          updated++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'updated',
          });
        } else {
          await this.prisma.brand.create({
            data: {
              id: record.id,
              ...brandData,
            },
          });
          created++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'created',
          });
        }
        processed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[SyncReceiver] Brand upsert failed for ${record.id}`, { error: message });
        records.push({
          id: record.id,
          status: 'failed',
          action: 'skipped',
          error: message,
        });
      }
    }

    return { processed, failed, created, updated, records };
  }

  /**
   * Category verilerini batch olarak işler (upsert) - Optimized for high traffic
   */
  private async processCategoryBatch(data: SyncRecord[]): Promise<ProcessResult> {
    if (data.length === 0) {
      return { processed: 0, failed: 0, created: 0, updated: 0, records: [] };
    }

    const records: ProcessedRecord[] = [];
    const recordIds = data.map((r) => r.id);

    // Tüm ID'leri bir kerede çek
    const existingCategories = await this.prisma.category.findMany({
      where: { id: { in: recordIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingCategories.map((c) => c.id));
    const toCreate: typeof data = [];
    const toUpdate: typeof data = [];

    // Parent'ları önce işlemek için sıralama
    const sortedData = [...data].sort((a, b) => {
      if (!a.parent_id && b.parent_id) return -1;
      if (a.parent_id && !b.parent_id) return 1;
      return 0;
    });

    // Kayıtları create ve update listelerine ayır
    for (const record of sortedData) {
      if (existingIds.has(record.id)) {
        toUpdate.push(record);
      } else {
        toCreate.push(record);
      }
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    // Transaction içinde batch işlemler
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Batch create
          if (toCreate.length > 0) {
            const createData = toCreate.map((record) => ({
              id: record.id,
              name: record.name || record.title || 'Unnamed Category',
              description: record.description || null,
              thumbnail: record.thumbnail || record.image_url || null,
              handle: record.handle || null,
              mpath: (record.mpath as string) || null,
              rank: record.rank || null,
              parentId: record.parent_id || null,
              isActive: record.is_active !== undefined ? record.is_active : true,
              metadata: record.metadata || {},
              level: record.level || 0,
            }));

            await tx.category.createMany({
              data: createData,
              skipDuplicates: true,
            });

            created = toCreate.length;
            toCreate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'created',
              });
            });
          }

          // Batch update - paralel işlem
          if (toUpdate.length > 0) {
            const updatePromises = toUpdate.map((record) =>
              tx.category.update({
                where: { id: record.id },
                data: {
                  name: record.name || record.title || 'Unnamed Category',
                  description: record.description || null,
                  thumbnail: record.thumbnail || record.image_url || null,
                  handle: record.handle || null,
                  mpath: (record.mpath as string) || null,
                  rank: record.rank || null,
                  parentId: record.parent_id || null,
                  isActive: record.is_active !== undefined ? record.is_active : true,
                  metadata: record.metadata || {},
                },
              }),
            );

            await Promise.all(updatePromises);
            updated = toUpdate.length;
            toUpdate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'updated',
              });
            });
          }
        },
        {
          timeout: 30000, // 30 saniye timeout
        },
      );
    } catch (error) {
      logger.warn('[SyncReceiver] Category batch transaction failed, falling back to individual upserts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.processCategoryBatchFallback(data);
    }

    return {
      processed: created + updated,
      failed,
      created,
      updated,
      records,
    };
  }

  /**
   * Category batch işlemi için fallback
   */
  private async processCategoryBatchFallback(data: SyncRecord[]): Promise<ProcessResult> {
    const records: ProcessedRecord[] = [];
    let processed = 0;
    let failed = 0;
    let created = 0;
    let updated = 0;

    // Parent'ları önce işlemek için sıralama
    const sortedData = [...data].sort((a, b) => {
      if (!a.parent_id && b.parent_id) return -1;
      if (a.parent_id && !b.parent_id) return 1;
      return 0;
    });

    for (const record of sortedData) {
      try {
        const categoryData = {
          name: record.name || record.title || 'Unnamed Category',
          description: record.description || null,
          thumbnail: record.thumbnail || record.image_url || null,
          handle: record.handle || null,
          mpath: (record.mpath as string) || null,
          rank: record.rank || null,
          parentId: record.parent_id || null,
          isActive: record.is_active !== undefined ? record.is_active : true,
          metadata: record.metadata || {},
        };

        // Önce var mı kontrol et
        const existing = await this.prisma.category.findUnique({
          where: { id: record.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.category.update({
            where: { id: record.id },
            data: categoryData,
          });
          updated++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'updated',
          });
        } else {
          await this.prisma.category.create({
            data: {
              id: record.id,
              ...categoryData,
            },
          });
          created++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'created',
          });
        }
        processed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[SyncReceiver] Category upsert failed for ${record.id}`, { error: message });
        records.push({
          id: record.id,
          status: 'failed',
          action: 'skipped',
          error: message,
        });
      }
    }

    return { processed, failed, created, updated, records };
  }

  /**
   * Product verilerini batch olarak işler (upsert) - Optimized for high traffic
   */
  private async processProductBatch(data: SyncRecord[]): Promise<ProcessResult> {
    if (data.length === 0) {
      return { processed: 0, failed: 0, created: 0, updated: 0, records: [] };
    }

    const records: ProcessedRecord[] = [];
    const recordIds = data.map((r) => r.id);

    // Tüm ID'leri bir kerede çek
    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: recordIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingProducts.map((p) => p.id));
    const toCreate: typeof data = [];
    const toUpdate: typeof data = [];

    // Kayıtları create ve update listelerine ayır
    for (const record of data) {
      if (existingIds.has(record.id)) {
        toUpdate.push(record);
      } else {
        toCreate.push(record);
      }
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    // Transaction içinde batch işlemler
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Batch create
          if (toCreate.length > 0) {
            const createData = toCreate.map((record) => ({
              id: record.id,
              name: record.name || record.title || 'Unnamed Product',
              description: record.description || null,
              brand: record.brand || null,
              subName: record.sub_name || null,
              imageUrl: record.image_url || record.thumbnail || null,
              thumbnail: record.thumbnail || record.image_url || null,
              groupId: record.group_id || null,
              categoryId: record.category_id || null,
              metadata: record.metadata || {},
            }));

            await tx.product.createMany({
              data: createData,
              skipDuplicates: true,
            });

            created = toCreate.length;
            toCreate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'created',
              });
            });
          }

          // Batch update - paralel işlem
          if (toUpdate.length > 0) {
            const updatePromises = toUpdate.map((record) =>
              tx.product.update({
                where: { id: record.id },
                data: {
                  name: record.name || record.title || 'Unnamed Product',
                  description: record.description || null,
                  brand: record.brand || null,
                  subName: record.sub_name || null,
                  imageUrl: record.image_url || record.thumbnail || null,
                  thumbnail: record.thumbnail || record.image_url || null,
                  groupId: record.group_id || null,
                  categoryId: record.category_id || null,
                  metadata: record.metadata || {},
                },
              }),
            );

            await Promise.all(updatePromises);
            updated = toUpdate.length;
            toUpdate.forEach((record) => {
              records.push({
                id: record.id,
                status: 'success',
                action: 'updated',
              });
            });
          }
        },
        {
          timeout: 30000, // 30 saniye timeout
        },
      );
    } catch (error) {
      logger.warn('[SyncReceiver] Product batch transaction failed, falling back to individual upserts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.processProductBatchFallback(data);
    }

    return {
      processed: created + updated,
      failed,
      created,
      updated,
      records,
    };
  }

  /**
   * Product batch işlemi için fallback
   */
  private async processProductBatchFallback(data: SyncRecord[]): Promise<ProcessResult> {
    const records: ProcessedRecord[] = [];
    let processed = 0;
    let failed = 0;
    let created = 0;
    let updated = 0;

    for (const record of data) {
      try {
        const productData = {
          name: record.name || record.title || 'Unnamed Product',
          description: record.description || null,
          brand: record.brand || null,
          subName: record.sub_name || null,
          imageUrl: record.image_url || record.thumbnail || null,
          thumbnail: record.thumbnail || record.image_url || null,
          groupId: record.group_id || null,
          categoryId: record.category_id || null,
          metadata: record.metadata || {},
        };

        // Önce var mı kontrol et
        const existing = await this.prisma.product.findUnique({
          where: { id: record.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: record.id },
            data: productData,
          });
          updated++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'updated',
          });
        } else {
          await this.prisma.product.create({
            data: {
              id: record.id,
              ...productData,
            },
          });
          created++;
          records.push({
            id: record.id,
            status: 'success',
            action: 'created',
          });
        }
        processed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[SyncReceiver] Product upsert failed for ${record.id}`, { error: message });
        records.push({
          id: record.id,
          status: 'failed',
          action: 'skipped',
          error: message,
        });
      }
    }

    return { processed, failed, created, updated, records };
  }

  /**
   * Sync secret token'ı doğrular
   */
  validateSyncSecret(providedSecret: string | string[] | undefined): boolean {
    const expectedSecret = process.env.SYNC_SECRET_TOKEN;
    
    // Secret tanımlı değilse, güvenlik nedeniyle reddet
    if (!expectedSecret) {
      logger.warn('[SyncReceiver] SYNC_SECRET_TOKEN is not configured');
      return false;
    }

    // Secret sağlanmamışsa reddet
    if (!providedSecret) {
      return false;
    }

    const secret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;
    return secret === expectedSecret;
  }

  /**
   * Payload validasyonu yapar
   */
  validatePayload(payload: unknown): { valid: boolean; error?: string } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Invalid payload: expected an object' };
    }

    const p = payload as Record<string, unknown>;

    if (!p.sync_id || typeof p.sync_id !== 'string') {
      return { valid: false, error: "Invalid payload: 'sync_id' is required and must be a string" };
    }

    if (!p.job_id || typeof p.job_id !== 'string') {
      return { valid: false, error: "Invalid payload: 'job_id' is required and must be a string" };
    }

    if (!p.module_type || !['product', 'category', 'brand'].includes(p.module_type as string)) {
      return { valid: false, error: "Invalid payload: 'module_type' must be 'product', 'category', or 'brand'" };
    }

    if (typeof p.batch_number !== 'number' || p.batch_number < 1) {
      return { valid: false, error: "Invalid payload: 'batch_number' must be a positive number" };
    }

    if (typeof p.total_batches !== 'number' || p.total_batches < 1) {
      return { valid: false, error: "Invalid payload: 'total_batches' must be a positive number" };
    }

    if (!p.data || !Array.isArray(p.data)) {
      return { valid: false, error: "Invalid payload: 'data' must be an array" };
    }

    return { valid: true };
  }

  /**
   * Modül tipine göre toplam kayıt sayısını döner
   */
  async getModuleStats(moduleType: SyncModuleType): Promise<{ count: number }> {
    switch (moduleType) {
      case 'brand':
        return { count: await this.prisma.brand.count() };
      case 'category':
        return { count: await this.prisma.category.count() };
      case 'product':
        return { count: await this.prisma.product.count() };
      default:
        return { count: 0 };
    }
  }
}

