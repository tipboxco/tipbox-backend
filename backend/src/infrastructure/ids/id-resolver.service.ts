import { getPrisma } from '../repositories/prisma.client';
import logger from '../logger/logger';

/**
 * Tek noktadan ID çözümlemesi: Medusa, externalId, UUID, ULID vb. formatları
 * ilgili tablonun primary key'ine çevirir. Medusa modunda category/subcategory/product group
 * tek tabloda (categories); product ayrı tabloda (products).
 */
export class IdResolverService {
  private readonly prisma = getPrisma();

  /**
   * categories.id döner. sub_category / product_group contextId için kullanılır (Medusa modu).
   * Arama: categories.id → metadata->>'externalId' → metadata->>'medusaId' → metadata text.
   */
  async resolveCategoryId(categoryId: string): Promise<string> {
    if (!categoryId || categoryId.trim() === '') {
      throw new Error('Category ID cannot be empty');
    }
    const trimmedId = categoryId.trim();

    try {
      const category = await this.prisma.category.findUnique({
        where: { id: trimmedId },
        select: { id: true },
      });
      if (category) return category.id;
    } catch {
      // ID formatı Prisma için geçersiz olabilir
    }

    try {
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM categories
        WHERE metadata->>'externalId' = ${trimmedId} OR metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;
      if (result?.length) return result[0].id;
    } catch (e) {
      logger.debug({
        message: 'Category metadata lookup failed',
        categoryId: trimmedId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM categories WHERE metadata::text LIKE ${'%' + trimmedId + '%'} LIMIT 1
      `;
      if (result?.length) return result[0].id;
    } catch {
      // ignore
    }

    throw new Error(`Category not found: ${categoryId}`);
  }

  /**
   * products.id döner. Arama: products.id → metadata->>'externalId' → metadata->>'medusaId'.
   */
  async resolveProductId(productIdOrExternalId: string): Promise<string> {
    const trimmed = productIdOrExternalId?.trim() || '';
    if (!trimmed) throw new Error('Product ID cannot be empty');

    const product = await this.prisma.product.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    if (product) return product.id;

    try {
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM products
        WHERE metadata->>'externalId' = ${trimmed} OR metadata->>'medusaId' = ${trimmed}
        LIMIT 1
      `;
      if (result?.length) return result[0].id;
    } catch (e) {
      logger.warn({
        message: 'Product externalId/medusaId lookup failed',
        productIdOrExternalId: trimmed,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    throw new Error(`Product not found with id or externalId: ${productIdOrExternalId}`);
  }

  /**
   * brands.id (UUID) döner. Arama: brands.id → brands.external_id.
   */
  async resolveBrandId(brandIdOrExternalId: string): Promise<string> {
    const trimmed = brandIdOrExternalId?.trim() || '';
    if (!trimmed) throw new Error('Brand ID cannot be empty');

    const brand = await this.prisma.brand.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    if (brand) return brand.id;

    const byExternal = await this.prisma.brand.findUnique({
      where: { externalId: trimmed },
      select: { id: true },
    });
    if (byExternal) return byExternal.id;

    throw new Error(`Brand not found: ${brandIdOrExternalId}`);
  }

  /**
   * content_posts.id döner. Bulunamazsa null.
   * Arama: content_posts.id (ULID) → (UUID ise) content_favorites.id → content_likes.id (postId varsa).
   */
  async resolvePostId(id: string): Promise<string | null> {
    const trimmed = id?.trim() || '';
    if (!trimmed) return null;

    logger.debug(`[ID Resolution] Resolving post ID: ${trimmed} (length: ${trimmed.length})`);

    // 1. Önce ContentPost'ta ara (ULID)
    const post = await this.prisma.contentPost.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    if (post) {
      logger.debug(`[ID Resolution] Found ContentPost directly: ${post.id}`);
      return post.id;
    }

    // 2. UUID formatında mı kontrol et (36 karakter)
    if (
      trimmed.length === 36 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    ) {
      logger.debug(`[ID Resolution] UUID format detected, checking alternative sources...`);

      // 2a. ContentFavorite'te ara
      const fav = await this.prisma.contentFavorite.findUnique({
        where: { id: trimmed },
        select: { postId: true },
      });
      if (fav?.postId) {
        logger.debug(`[ID Resolution] Found in ContentFavorite, resolved to post: ${fav.postId}`);
        return fav.postId;
      }

      // 2b. ContentLike'ta ara
      const like = await this.prisma.contentLike.findUnique({
        where: { id: trimmed },
        select: { postId: true },
      });
      if (like?.postId) {
        logger.debug(`[ID Resolution] Found in ContentLike, resolved to post: ${like.postId}`);
        return like.postId;
      }

      // 2c. Inventory'de ara (legacy review system)
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: trimmed },
        select: { experienceSnippetId: true, userId: true, productId: true },
      });
      logger.debug(`[ID Resolution] Inventory lookup result: ${inventory ? 'found' : 'not found'}`, {
        hasExperienceSnippetId: !!inventory?.experienceSnippetId,
      });

      if (inventory) {
        // experienceSnippetId ile ilişkili ContentPost'u bul
        const relatedPost = await this.prisma.contentPost.findFirst({
          where: {
            userId: inventory.userId,
            productId: inventory.productId,
            type: 'EXPERIENCE',
            ...(inventory.experienceSnippetId && { experienceSnippetId: inventory.experienceSnippetId }),
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });
        if (relatedPost) {
          logger.debug(`[ID Resolution] Found related ContentPost via Inventory: ${relatedPost.id}`);
          return relatedPost.id;
        } else {
          logger.warn(`[ID Resolution] Inventory found but no related ContentPost exists`, {
            inventoryId: trimmed,
            experienceSnippetId: inventory.experienceSnippetId || 'null',
            userId: inventory.userId,
            productId: inventory.productId,
          });
        }
      }
    }

    logger.warn(`[ID Resolution] Failed to resolve post ID: ${trimmed}`);
    return null;
  }
}
