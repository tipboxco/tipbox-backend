import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { withCache } from '../../infrastructure/cache/cache-wrapper.helper';
import { CACHE_KEYS } from '../../infrastructure/cache/cache-keys';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { FeedItem, FeedItemType } from '../../interfaces/feed/feed.dto';
import { ContextType } from '../../domain/content/context-type.enum';
import { ContentPostType } from '../../domain/content/content-post-type.enum';

const prisma = getPrisma();

export interface CategoryItem {
  categoryId: string;
  name: string;
  image: string | null;
}

export interface SubCategoryItem {
  subCategoryId: string;
  name: string;
  image: string | null;
  categoryId: string;
}

export interface ProductGroupItem {
  productGroupId: string;
  name: string;
  image: string | null;
  subCategoryId: string;
}

export interface ProductItem {
  productId: string;
  name: string;
  image: string | null;
  productGroupId: string;
}

export interface ProductDetail {
  productId: string;
  name: string;
  subName: string | null;
  description: string | null;
  image: string | null;
  brand: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  specs: string[];
  price: number | null;
  currency: string | null;
}

export class CatalogService {
  /**
   * Category ID'yi resolve eder - tüm ID formatlarını kabul eder
   * Medusa ID formatlarını (pcat_, mcat_, scat_), UUID, ULID ve diğer formatları destekler
   * Eğer Category tablosunda bulunamazsa, direkt ID'yi döndürür (parentId olarak kullanılabilir)
   */
  private async resolveCategoryId(categoryId: string): Promise<string> {
    if (!categoryId || categoryId.trim() === '') {
      throw new Error('Category ID cannot be empty');
    }

    const trimmedId = categoryId.trim();

    // 1. Önce direkt id ile ara - herhangi bir format kabul edilir
    try {
      const category = await prisma.category.findUnique({
        where: { id: trimmedId },
        select: { id: true },
      });
      if (category) {
        return category.id;
      }
    } catch (error) {
      // ID formatı Prisma için geçersiz olabilir - devam et
    }

    // 2. Metadata içindeki externalId ile ara
    try {
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id 
        FROM categories 
        WHERE metadata->>'externalId' = ${trimmedId}
        LIMIT 1
      `;

      if (result && result.length > 0) {
        return result[0].id;
      }
    } catch (error) {
      // Metadata query hatası - devam et
    }

    // 3. Metadata içindeki medusaId ile ara (alternatif field adı)
    try {
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id 
        FROM categories 
        WHERE metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;

      if (result && result.length > 0) {
        return result[0].id;
      }
    } catch (error) {
      // Metadata query hatası - devam et
    }

    // 4. Metadata içindeki herhangi bir field'da bu ID'yi ara
    try {
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id 
        FROM categories 
        WHERE metadata::text LIKE ${'%' + trimmedId + '%'}
        LIMIT 1
      `;

      if (result && result.length > 0) {
        return result[0].id;
      }
    } catch (error) {
      // Metadata query hatası - devam et
    }

    // 5. Eğer hiçbir yerde bulunamazsa, direkt ID'yi döndür
    // Category tablosunda ID String tipinde olduğu için herhangi bir format kabul edilir
    // Bu ID parentId olarak kullanılabilir veya yeni bir Category oluşturulabilir
    return trimmedId;
  }

  /**
   * Tüm kategorileri listele
   */
  async getAllCategories(): Promise<CategoryItem[]> {
    return withCache(
      CACHE_KEYS.STATIC_CATEGORIES()+"asdad",
      async () => {
        const categories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
            thumbnail: true,
            
          },
          where: {
            level: 0
          }
        });
        console.log({categories});
        const { resolveMediaUrl } = await import('../../infrastructure/config/media.config');

        return categories.map((category: any) => {
          const imageUrl = resolveMediaUrl(category.thumbnail);

          return {
            categoryId: category.id,
            name: category.name,
            image: imageUrl,
          };
        });
      },
      15,
      //CACHE_TTL.STATIC_CATEGORIES, // 24 saat - kategoriler çok nadir değişir
      { logPrefix: 'CatalogService' }
    );
  }

  /**
   * Kategoriye göre sub-kategorileri listele (cursor-based pagination)
   */
  async getSubCategoriesByCategoryId(
    categoryId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: SubCategoryItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;

    try {
      // Category ID'yi resolve et - tüm ID formatlarını kabul eder
      const resolvedCategoryId = await this.resolveCategoryId(categoryId);

      const whereClause: any = {
        parentId: resolvedCategoryId,
      };

      if (cursor) {
        whereClause.id = {
          gt: cursor,
        };
      }

      const subCategories = await prisma.category.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          thumbnail: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = subCategories.length > limit;
      const resultSubCategories = hasMore ? subCategories.slice(0, limit) : subCategories;
      const nextCursor = hasMore && resultSubCategories.length > 0 
        ? resultSubCategories[resultSubCategories.length - 1].id 
        : undefined;

      const items = resultSubCategories.map((subCategory: any) => {
        const imageUrl = resolveMediaUrl(subCategory.thumbnail);

        return {
          subCategoryId: subCategory.id,
          categoryId: resolvedCategoryId,
          name: subCategory.name,
          image: imageUrl,
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get sub-categories for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Sub-kategoriye göre product group'ları listele (cursor-based pagination)
   */
  async getProductGroupsBySubCategoryId(
    subCategoryId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: ProductGroupItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;

    try {
      // Sub Category ID'yi resolve et - tüm ID formatlarını kabul eder
      const resolvedSubCategoryId = await this.resolveCategoryId(subCategoryId);

      const whereClause: any = {
        parentId: resolvedSubCategoryId,
      };

      if (cursor) {
        whereClause.id = {
          gt: cursor,
        };
      }

      const productGroups = await prisma.category.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          thumbnail: true,
          parentId: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = productGroups.length > limit;
      const resultProductGroups = hasMore ? productGroups.slice(0, limit) : productGroups;
      const nextCursor = hasMore && resultProductGroups.length > 0 
        ? resultProductGroups[resultProductGroups.length - 1].id 
        : undefined;

      const items = resultProductGroups.map((group: any) => {
        const imageUrl = resolveMediaUrl(group.thumbnail);

        return {
          productGroupId: group.id,
          name: group.name,
          image: imageUrl,
          subCategoryId: group.parentId || '',
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product groups for sub-category ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product group'a göre ürünleri listele (cursor-based pagination)
   */
  async getProductsByProductGroupId(
    productGroupId: string,
    search?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: ProductItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const searchTrimmed = search?.trim();

    // Helper: kategori için tüm alt kategori id'lerini rekürsif olarak bul (kendisi dahil)
    async function getAllDescendantCategoryIds(categoryId: string): Promise<string[]> {
      const ids: string[] = [categoryId];

      // İlk seviye children
      const children = await prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });

      for (const child of children) {
        const childDescendants = await getAllDescendantCategoryIds(child.id);
        ids.push(...childDescendants);
      }

      return ids;
    }

    try {
      // productGroupId ile başla, tüm child/alt kategorilerin id'lerini bul
      const categoryIds = await getAllDescendantCategoryIds(productGroupId);

      const whereClause: any = {
        categoryId: { in: categoryIds },
        ...(searchTrimmed && {
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' } },
            { brand: { name: { contains: searchTrimmed, mode: 'insensitive' } } },
            { description: { contains: searchTrimmed, mode: 'insensitive' } },
          ],
        }),
      };

      if (cursor) {
        whereClause.id = {
          gt: cursor,
        };
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          categoryId: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = products.length > limit;
      const resultProducts = hasMore ? products.slice(0, limit) : products;
      const nextCursor = hasMore && resultProducts.length > 0 
        ? resultProducts[resultProducts.length - 1].id 
        : undefined;

      const items = resultProducts.map((product: any) => {
        const imageUrl = resolveMediaUrl(product.imageUrl);

        return {
          productId: product.id,
          name: product.name,
          image: imageUrl,
          productGroupId: product.categoryId || '',
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get products for product group ${productGroupId}:`, error);
      throw error;
    }
  }

  /**
   * Product detay bilgilerini getir
   */
  async getProductById(productId: string): Promise<ProductDetail> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          group: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Brand bilgisini al (product.brand string olarak saklanıyor)
      let brandData: { id: string; name: string; image: string | null } | null = null;
      if (product.brand) {
        const brand = await prisma.brand.findFirst({
          where: { name: product.brand },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        });

        if (brand) {
          brandData = {
            id: brand.id,
            name: brand.name,
            image: resolveMediaUrl(brand.imageUrl),
          };
        }
      }

      // Specs'i parse et (eğer description'da varsa veya ayrı bir alan varsa)
      // Şimdilik boş array döndürüyoruz, ileride specs alanı eklenebilir
      const specs: string[] = [];

      // Price ve currency şimdilik null, ileride eklenebilir
      const price: number | null = null;
      const currency: string | null = null;

      return {
        productId: product.id,
        name: product.name,
        subName: product.subName,
        description: product.description,
        image: resolveMediaUrl(product.imageUrl),
        brand: brandData,
        specs,
        price,
        currency,
      };
    } catch (error) {
      logger.error(`Failed to get product detail for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Product'a ait post'ları getir
   * Filtreler: all, free, tips_and_tricks, questions, updates, benchmarks, reviews
   * Sıralama: newest, oldest, most_popular
   */
  async getProductPosts(
    productId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions, updates, benchmarks, reviews
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: Array<{ type: string; data: any }>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      // Product'ın var olup olmadığını kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, tips_and_tricks, questions, updates, benchmarks, reviews
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Filtreleme: Product için (FREE hariç: EXPERIENCE, TIPS, COMPARE, QUESTION, UPDATE)
      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else if (filter === 'updates') {
        typeFilter = [ContentPostType.UPDATE];
      } else if (filter === 'benchmarks') {
        typeFilter = [ContentPostType.COMPARE];
      } else if (filter === 'reviews') {
        typeFilter = [ContentPostType.EXPERIENCE];
      } else if (filter === 'all') {
        // Product için izin verilen tüm post tipleri (FREE hariç)
        typeFilter = this.getAllowedPostTypesForContext(ContextType.PRODUCT);
      }

      const whereClause: any = {
        productId: productId,
      };

      if (typeFilter) {
        whereClause.type = { in: typeFilter };
      }

      const posts = await prisma.contentPost.findMany({
        where: whereClause,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular' 
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest' 
                ? { createdAt: 'asc' } 
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedPosts = posts;
      if (sort === 'most_popular') {
        sortedPosts = posts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedPosts.length > limit;
      const resultPosts = hasMore ? sortedPosts.slice(0, limit) : sortedPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Map ContentPostType to FeedItemType
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
          case ContentPostType.UPDATE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items
      const feedItems: Array<{ type: string; data: any }> = resultPosts.map((post: any) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type);
        const contextData = this.buildContextDataFromPost(post);

        const baseData = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: (post as any).likesCount ?? post.likes?.length ?? 0,
            comments: (post as any).commentsCount ?? post.comments?.length ?? 0,
            shares: (post as any).sharesCount ?? 0,
            bookmarks: (post as any).favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images: (post.media || []).map((m: any) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
        };

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product posts for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Context seviyesine göre izin verilen post tiplerini döndürür
   */
  private getAllowedPostTypesForContext(contextType: ContextType): ContentPostType[] {
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
      case ContextType.PRODUCT_GROUP:
        // Sub category ve product group için sadece Free, Tips, Question
        return [ContentPostType.FREE, ContentPostType.TIPS, ContentPostType.QUESTION];
      case ContextType.PRODUCT:
        // Product için: Experience, Tips, Compare, Question, Update (FREE hariç)
        return [
          ContentPostType.TIPS,
          ContentPostType.QUESTION,
          ContentPostType.EXPERIENCE,
          ContentPostType.UPDATE,
          ContentPostType.COMPARE,
        ];
      default:
        return [];
    }
  }

  /**
   * Post'tan context data oluşturur
   */
  private buildContextDataFromPost(post: any): any {
    // Product context
    if (post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;
      const mainCategory = subCategory?.mainCategory;
      const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: product.id,
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    // Product Group context
    if (post.productGroup) {
      const group = post.productGroup;
      const subCategory = group.subCategory;
      const mainCategory = subCategory?.mainCategory;
      const imagePath = group.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: group.id,
        name: group.name,
        subName: subCategory?.name || mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    // Sub Category context
    if (post.subCategory) {
      const subCategory = post.subCategory;
      const mainCategory = subCategory.mainCategory;
      const imagePath = subCategory.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: subCategory.id,
        name: subCategory.name,
        subName: mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    return {
      id: '',
      name: '',
      subName: '',
      image: null,
    };
  }

  /**
   * Sub category'ye ait post'ları getir (hiyerarşik feed)
   * Sub category'ye ait + alt product group'ların + alt product'ların gönderilerini getirir
   * Filtreler: all, free, tips_and_tricks, questions
   * Sıralama: newest, oldest, most_popular
   */
  async getSubCategoryPosts(
    subCategoryId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: Array<{ type: string; data: any }>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      // Sub category ID'yi resolve et - tüm ID formatlarını kabul eder
      // Önce Category tablosunda ara (String ID kabul eder)
      let resolvedSubCategoryId: string | null = null;
      let actualSubCategoryId: string | null = null;

      // 1. Önce Category tablosunda ara (Medusa ID formatlarını destekler)
      const category = await prisma.category.findUnique({
        where: { id: subCategoryId },
        select: { id: true, name: true },
      });

      if (category) {
        // Category bulundu - name ile SubCategory'de ara
        const subCategory = await prisma.subCategory.findFirst({
          where: { name: category.name },
          select: { id: true },
        });
        if (subCategory) {
          actualSubCategoryId = subCategory.id;
          resolvedSubCategoryId = category.id; // Category ID'yi context için kullan
        }
      }

      // 2. Category'de bulunamadı - direkt SubCategory'de ara (UUID formatı)
      if (!actualSubCategoryId) {
        try {
          const subCategory = await prisma.subCategory.findUnique({
            where: { id: subCategoryId },
            select: { id: true },
          });
          if (subCategory) {
            actualSubCategoryId = subCategory.id;
            resolvedSubCategoryId = subCategory.id;
          }
        } catch (error) {
          // UUID formatı değil - Category tablosunu kullan
        }
      }

      // 3. Hiçbir yerde bulunamadı - Category ID'yi direkt kullan (parentId olarak)
      if (!resolvedSubCategoryId) {
        resolvedSubCategoryId = subCategoryId;
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, free, tips_and_tricks, questions
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Alt product group'ları getir
      // Eğer actualSubCategoryId varsa onu kullan, yoksa Category ID ile product group'ları bul
      let productGroupIds: string[] = [];
      
      if (actualSubCategoryId) {
        // SubCategory'den product group'ları getir
        const productGroups = await prisma.productGroup.findMany({
          where: { subCategoryId: actualSubCategoryId },
          select: { id: true },
        });
        productGroupIds = productGroups.map((pg) => pg.id);
      } else if (category) {
        // Category ID ile product group'ları bul (Category tablosundan)
        const categoryProductGroups = await prisma.category.findMany({
          where: { parentId: category.id },
          select: { id: true, name: true },
        });
        
        // Category name'lerini kullanarak ProductGroup'ları bul
        const categoryNames = categoryProductGroups.map(c => c.name);
        if (categoryNames.length > 0) {
          const productGroups = await prisma.productGroup.findMany({
            where: { name: { in: categoryNames } },
            select: { id: true },
          });
          productGroupIds = productGroups.map((pg) => pg.id);
        }
      }

      // Alt product'ları getir - sadece geçerli UUID'ler varsa
      // ProductGroup ID'lerinin UUID formatında olduğundan emin ol
      let productIds: string[] = [];
      if (productGroupIds.length > 0) {
        // UUID formatını kontrol et (8-4-4-4-12 formatı)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validProductGroupIds = productGroupIds.filter(id => uuidRegex.test(id));
        
        if (validProductGroupIds.length > 0) {
          try {
            const products = await prisma.product.findMany({
              where: { groupId: { in: validProductGroupIds } },
              select: { id: true },
            });
            productIds = products.map((p) => p.id);
          } catch (error) {
            // ProductGroup ID'leri geçersiz olabilir - boş bırak
            logger.warn(`Failed to get products for product groups: ${validProductGroupIds.join(', ')}`, error);
          }
        } else {
          logger.warn(`No valid UUID product group IDs found. Received: ${productGroupIds.join(', ')}`);
        }
      }

      // Filtreleme: Sub category için
      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'free') {
        typeFilter = [ContentPostType.FREE];
      } else if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else {
        // filter === 'all' ise context seviyesine göre otomatik filtreleme
        typeFilter = this.getAllowedPostTypesForContext(ContextType.SUB_CATEGORY);
      }

      // Eğer SubCategory bulunamadıysa, Category'den child category'leri bul ve onların name'lerini kullan
      if (!actualSubCategoryId && category) {
        // Category'nin child category'lerini bul
        const childCategories = await prisma.category.findMany({
          where: { parentId: category.id },
          select: { id: true, name: true },
        });
        
        // Child category name'lerini kullanarak SubCategory'leri bul
        const subCategoryNames = childCategories.map(c => c.name);
        if (subCategoryNames.length > 0) {
          const subCategories = await prisma.subCategory.findMany({
            where: { name: { in: subCategoryNames } },
            select: { id: true },
          });
          actualSubCategoryId = subCategories.length > 0 ? subCategories[0].id : null;
        }
      }

      // Hiyerarşik where clause: sub category + alt product groups + alt products
      const whereClause: any = {
        OR: [
          // SubCategory ID'yi kullan (UUID formatında)
          ...(actualSubCategoryId ? [{ subCategoryId: actualSubCategoryId }] : []),
          ...(productGroupIds.length > 0 ? [{ productGroupId: { in: productGroupIds } }] : []),
          ...(productIds.length > 0 ? [{ productId: { in: productIds } }] : []),
        ],
      };

      // Post type filtreleme
      if (typeFilter) {
        whereClause.type = { in: typeFilter };
      }

      const posts = await prisma.contentPost.findMany({
        where: whereClause,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
          mainCategory: true,
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular' 
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest' 
                ? { createdAt: 'asc' } 
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedPosts = posts;
      if (sort === 'most_popular') {
        sortedPosts = posts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedPosts.length > limit;
      const resultPosts = hasMore ? sortedPosts.slice(0, limit) : sortedPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Map ContentPostType to FeedItemType
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
          case ContentPostType.UPDATE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items
      const feedItems: Array<{ type: string; data: any }> = resultPosts.map((post) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type);
        const contextData = this.buildContextDataFromPost(post);

        const baseData = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: (post as any).likesCount ?? post.likes?.length ?? 0,
            comments: (post as any).commentsCount ?? post.comments?.length ?? 0,
            shares: (post as any).sharesCount ?? 0,
            bookmarks: (post as any).favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images: (post.media || []).map((m: any) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
        };

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get sub category posts for ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product group'a ait post'ları getir (hiyerarşik feed)
   * Product group'a ait + alt product'ların gönderilerini getirir
   * Filtreler: all, free, tips_and_tricks, questions
   * Sıralama: newest, oldest, most_popular
   */
  async getProductGroupPosts(
    productGroupId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: Array<{ type: string; data: any }>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      // Product group ID'yi resolve et - tüm ID formatlarını kabul eder
      let actualProductGroupId: string | null = null;

      // 1. Önce Category tablosunda ara (Medusa ID formatlarını destekler)
      const category = await prisma.category.findUnique({
        where: { id: productGroupId },
        select: { id: true, name: true },
      });

      if (category) {
        // Category bulundu - name ile ProductGroup'da ara
        const productGroup = await prisma.productGroup.findFirst({
          where: { name: category.name },
          select: { id: true },
        });
        if (productGroup) {
          actualProductGroupId = productGroup.id;
        }
      }

      // 2. Category'de bulunamadı - direkt ProductGroup'da ara (UUID formatı)
      if (!actualProductGroupId) {
        try {
          const productGroup = await prisma.productGroup.findUnique({
            where: { id: productGroupId },
            select: { id: true },
          });
          if (productGroup) {
            actualProductGroupId = productGroup.id;
          }
        } catch (error) {
          // UUID formatı değil - devam et
        }
      }

      if (!actualProductGroupId) {
        // Product group bulunamadı - boş sonuç döndür
        return {
          items: [],
          pagination: {
            cursor: undefined,
            hasMore: false,
            limit: options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20,
          },
        };
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, free, tips_and_tricks, questions
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Alt product'ları getir
      const products = await prisma.product.findMany({
        where: { groupId: actualProductGroupId },
        select: { id: true },
      });
      const productIds = products.map((p) => p.id);

      // Filtreleme: Product group için
      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'free') {
        typeFilter = [ContentPostType.FREE];
      } else if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else {
        // filter === 'all' ise context seviyesine göre otomatik filtreleme
        typeFilter = this.getAllowedPostTypesForContext(ContextType.PRODUCT_GROUP);
      }

      // Hiyerarşik where clause: product group + alt products
      const whereClause: any = {
        OR: [
          { productGroupId: actualProductGroupId },
          ...(productIds.length > 0 ? [{ productId: { in: productIds } }] : []),
        ],
      };

      // Post type filtreleme
      if (typeFilter) {
        whereClause.type = { in: typeFilter };
      }

      const posts = await prisma.contentPost.findMany({
        where: whereClause,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
          mainCategory: true,
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular' 
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest' 
                ? { createdAt: 'asc' } 
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedPosts = posts;
      if (sort === 'most_popular') {
        sortedPosts = posts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedPosts.length > limit;
      const resultPosts = hasMore ? sortedPosts.slice(0, limit) : sortedPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Map ContentPostType to FeedItemType
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
          case ContentPostType.UPDATE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items
      const feedItems: Array<{ type: string; data: any }> = resultPosts.map((post) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type);
        const contextData = this.buildContextDataFromPost(post);

        const baseData = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: (post as any).likesCount ?? post.likes?.length ?? 0,
            comments: (post as any).commentsCount ?? post.comments?.length ?? 0,
            shares: (post as any).sharesCount ?? 0,
            bookmarks: (post as any).favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images: (post.media || []).map((m: any) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
        };

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product group posts for ${productGroupId}:`, error);
      throw error;
    }
  }

  /**
   * Product'a ait haberleri getir
   */
  async getProductNews(
    productId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      date: string;
      image: string;
    }>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      // Product'ın var olup olmadığını kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;

      // Product'a ait post'ları haber olarak getir
      const posts = await prisma.contentPost.findMany({
        where: {
          productId: productId,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          product: {
            include: {
              group: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Haber response formatına dönüştür
      const newsItems = resultPosts.map((post: any) => {
        const title = post.title || post.body?.slice(0, 80) || 'News';
        const description = post.body || '';
        const source = product.brand || 'tipbox';
        const image =
          (post as any).imageUrl ||
          post.product?.imageUrl ||
          post.product?.group?.imageUrl ||
          (post as any).thumbnailUrl ||
          '';

        return {
          id: post.id,
          title,
          description,
          source,
          date: post.createdAt.toISOString(),
          image: resolveMediaUrl(image),
        };
      });

      return {
        items: newsItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product news for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Global product search - Tüm product group'lar arasında arama
   * Sonuçları product group bazında gruplar
   */
  async searchProductsGlobally(
    search: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      productGroupId: string;
      productGroupName: string;
      productGroupImage: string | null;
      subCategoryId: string;
      subCategoryName: string;
      categoryId: string;
      categoryName: string;
      products: Array<{
        productId: string;
        name: string;
        image: string | null;
        productGroupId: string;
        subCategoryId: string;
      }>;
    }>;
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const searchTrimmed = search?.trim();

    if (!searchTrimmed || searchTrimmed.length === 0) {
      return {
        items: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit,
        },
      };
    }

    try {
      // Önce arama terimiyle eşleşen product'ları bul
      // ⚠️ KRİTİK: Sadece product name, description ve brand name'de arama yapılmalı
      // Product group veya kategori adı ile eşleşme YAPILMAMALI
      const matchingProducts = await prisma.product.findMany({
        where: {
          // Sadece ürün adı, açıklama ve marka adında arama
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' } },
            { description: { contains: searchTrimmed, mode: 'insensitive' } },
            { brand: { name: { contains: searchTrimmed, mode: 'insensitive' } } },
          ],
          // ⚠️ KRİTİK: Sadece groupId'si olan product'ları al (group'u olmayan product'ları atla)
          groupId: { not: null },
        },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
          group: {
            include: {
              subCategory: {
                include: {
                  mainCategory: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // ⚠️ KRİTİK: Aynı productId'ye sahip ürünlerin birden fazla group'ta görünmesini engelle
      // Her productId sadece bir kez eklenmeli (kendi group'unda)
      const processedProductIds = new Set<string>();
      
      // Product'ları product group bazında grupla
      const productGroupsMap = new Map<
        string,
        {
          productGroupId: string;
          productGroupName: string;
          productGroupImage: string | null;
          subCategoryId: string;
          subCategoryName: string;
          categoryId: string;
          categoryName: string;
          products: Array<{
            productId: string;
            name: string;
            image: string | null;
            productGroupId: string;
            subCategoryId: string;
          }>;
        }
      >();

      for (const product of matchingProducts) {
        // ⚠️ KRİTİK: Group'u olmayan product'ları atla
        if (!product.group) continue;

        // ⚠️ KRİTİK: Bu productId daha önce işlendiyse atla (aynı ürün farklı gruplarda görünmemeli)
        if (processedProductIds.has(product.id)) {
          logger.warn(`Product ${product.id} already processed, skipping duplicate`);
          continue;
        }

        const groupId = product.group.id;
        const subCategory = product.group.subCategory;
        const mainCategory = subCategory?.mainCategory;

        // ⚠️ KRİTİK: Product'ın groupId'si ile eşleşmeli
        if (product.groupId !== groupId) {
          logger.warn(`Product ${product.id} groupId mismatch: ${product.groupId} vs ${groupId}`);
          continue;
        }

        if (!productGroupsMap.has(groupId)) {
          productGroupsMap.set(groupId, {
            productGroupId: groupId,
            productGroupName: product.group.name,
            productGroupImage: resolveMediaUrl(product.group.imageUrl),
            subCategoryId: subCategory?.id || '',
            subCategoryName: subCategory?.name || '',
            categoryId: mainCategory?.id || '',
            categoryName: mainCategory?.name || '',
            products: [],
          });
        }

        // ⚠️ KRİTİK: Ürün görseli doğruluğu - image URL validation
        const productImageUrl = product.imageUrl;
        const resolvedImage = productImageUrl 
          ? resolveMediaUrl(productImageUrl) 
          : null;

        // Image URL validation: null, boş string veya geçersiz URL kontrolü
        const validImage = resolvedImage && 
          resolvedImage.trim().length > 0 && 
          (resolvedImage.startsWith('http://') || resolvedImage.startsWith('https://'));

        const groupData = productGroupsMap.get(groupId)!;
        groupData.products.push({
          productId: product.id,
          name: product.name,
          image: validImage ? resolvedImage : null, // Geçersiz URL'ler null olarak döndürülür
          productGroupId: groupId,
          subCategoryId: subCategory?.id || '',
        });

        // ProductId'yi işlenmiş olarak işaretle
        processedProductIds.add(product.id);
      }

      // ⚠️ KRİTİK: Sadece eşleşen ürünü olan product group'ları döndür
      // Boş product listesi olan group'ları filtrele
      let allGroups = Array.from(productGroupsMap.values())
        .filter((group) => group.products.length > 0); // En az bir ürünü olan group'lar

      // Cursor-based pagination: cursor varsa, o ID'den sonraki group'ları al
      if (cursor) {
        const cursorIndex = allGroups.findIndex((g) => g.productGroupId === cursor);
        if (cursorIndex >= 0) {
          allGroups = allGroups.slice(cursorIndex + 1);
        } else {
          // Cursor bulunamazsa, cursor ID'sinden büyük olanları al
          allGroups = allGroups.filter((g) => g.productGroupId > cursor);
        }
      }

      // Product group'ları ID'ye göre sırala (cursor-based pagination için)
      allGroups.sort((a, b) => a.productGroupId.localeCompare(b.productGroupId));

      // Limit + 1 al ki hasMore'u kontrol edebilelim
      const hasMore = allGroups.length > limit;
      const resultGroups = hasMore ? allGroups.slice(0, limit) : allGroups;
      const nextCursor = hasMore && resultGroups.length > 0 
        ? resultGroups[resultGroups.length - 1].productGroupId 
        : undefined;

      return {
        items: resultGroups,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to search products globally:`, error);
      throw error;
    }
  }
}

