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
   * Kategoriye göre sub-kategorileri listele
   */
  async getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategoryItem[]> {
    return withCache(
      CACHE_KEYS.CATEGORY(categoryId),
      async () => this.fetchSubCategories(categoryId),
      CACHE_TTL.CATEGORY, // 2 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchSubCategories(categoryId: string): Promise<SubCategoryItem[]> {
    try {
      const subCategories = await prisma.category.findMany({
        where: {
          parentId: categoryId,
        },
        select: {
          id: true,
          name: true,
          thumbnail: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return subCategories.map((subCategory: any) => {
        const imageUrl = resolveMediaUrl(subCategory.thumbnail);

        return {
          subCategoryId: subCategory.id,
          categoryId: categoryId,
          name: subCategory.name,
          image: imageUrl,
        };
      });
    } catch (error) {
      logger.error(`Failed to get sub-categories for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Sub-kategoriye göre product group'ları listele
   */
  async getProductGroupsBySubCategoryId(subCategoryId: string): Promise<ProductGroupItem[]> {
    return withCache(
      CACHE_KEYS.SUB_CATEGORY(subCategoryId),
      async () => this.fetchProductGroups(subCategoryId),
      CACHE_TTL.SUB_CATEGORY, // 2 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchProductGroups(subCategoryId: string): Promise<ProductGroupItem[]> {
    try {
      const productGroups = await prisma.category.findMany({
        where: {
          parentId: subCategoryId
        },
        select: {
          id: true,
          name: true,
          thumbnail: true,
          parentId: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return productGroups.map((group: any) => {
        const imageUrl = resolveMediaUrl(group.thumbnail);

        return {
          productGroupId: group.id,
          name: group.name,
          image: imageUrl,
          subCategoryId: group.parentId || '',
        };
      });
    } catch (error) {
      logger.error(`Failed to get product groups for sub-category ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product group'a göre ürünleri listele
   */
  async getProductsByProductGroupId(productGroupId: string, search?: string): Promise<ProductItem[]> {
    const searchTrimmed = search?.trim();
    const cacheKey = `product-group:${productGroupId}:products:${searchTrimmed || 'all'}+1`;
    return this.fetchProducts(productGroupId, searchTrimmed);
    return withCache(
      cacheKey,
      async () => this.fetchProducts(productGroupId, searchTrimmed),
      CACHE_TTL.CATEGORY_PRODUCTS, // 1 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchProducts(productGroupId: string, search?: string): Promise<ProductItem[]> {
   
    // Gelen productGroupId aslında bir üst kategori veya ara kategori olabilir.
    // O yüzden, öncelikle bu kategorinin altındaki tüm alt kategori id'lerini (children'lar dahil rekürsif olarak) bulmamız lazım, sonra ilgili id'lere sahip ürünleri getireceğiz.

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
    // productGroupId ile başla, tüm child/alt kategorilerin id'lerini bul
    const categoryIds = await getAllDescendantCategoryIds(productGroupId);
    try {
      const products = await prisma.product.findMany({
        where: {
          categoryId: {in:categoryIds},
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { brand: { name: { contains: search, mode: 'insensitive' } } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          categoryId: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return products.map((product: any) => {
        const imageUrl = resolveMediaUrl(product.imageUrl);

        return {
          productId: product.id,
          name: product.name,
          image: imageUrl,
          productGroupId: product.categoryId || '',
        };
      });
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

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, free, tips_and_tricks, questions, updates, benchmarks, reviews
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Filtreleme: Product için
      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'free') {
        typeFilter = [ContentPostType.FREE];
      } else if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else if (filter === 'updates') {
        typeFilter = [ContentPostType.UPDATE];
      } else if (filter === 'benchmarks') {
        typeFilter = [ContentPostType.COMPARE];
      } else if (filter === 'reviews') {
        typeFilter = [ContentPostType.EXPERIENCE];
      }
      // filter === 'all' ise tüm post tipleri (typeFilter undefined)

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
        // Product için tüm post tipleri
        return [
          ContentPostType.FREE,
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
      // Sub category'nin var olup olmadığını kontrol et
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
      });

      if (!subCategory) {
        throw new Error(`Sub category not found: ${subCategoryId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, free, tips_and_tricks, questions
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Alt product group'ları getir
      const productGroups = await prisma.productGroup.findMany({
        where: { subCategoryId: subCategoryId },
        select: { id: true },
      });
      const productGroupIds = productGroups.map((pg) => pg.id);

      // Alt product'ları getir
      const products = await prisma.product.findMany({
        where: { groupId: { in: productGroupIds } },
        select: { id: true },
      });
      const productIds = products.map((p) => p.id);

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

      // Hiyerarşik where clause: sub category + alt product groups + alt products
      const whereClause: any = {
        OR: [
          { subCategoryId: subCategoryId },
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
      // Product group'un var olup olmadığını kontrol et
      const productGroup = await prisma.productGroup.findUnique({
        where: { id: productGroupId },
      });

      if (!productGroup) {
        throw new Error(`Product group not found: ${productGroupId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, free, tips_and_tricks, questions
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Alt product'ları getir
      const products = await prisma.product.findMany({
        where: { groupId: productGroupId },
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
          { productGroupId: productGroupId },
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

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
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
}

