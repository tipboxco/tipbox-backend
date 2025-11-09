import { PrismaClient } from '@prisma/client';
import { FeedService } from '../feed/feed.service';
import { FeedItem, FeedItemType } from '../../interfaces/feed/feed.dto';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import logger from '../../infrastructure/logger/logger';

const prisma = new PrismaClient();

export interface BrandCategoryItem {
  categoryId: string;
  name: string;
  image: string | null;
}

export interface BrandItem {
  brandId: string;
  name: string;
  image: string | null;
}

export interface BrandCatalogResponse {
  brandId: string;
  name: string;
  description: string | null;
  followers: number;
  isJoined: boolean;
  posts: FeedItem[];
}

export interface BrandProductGroup {
  productGroupId: string;
  productGroupName: string;
  products: BrandProduct[];
}

export interface BrandProduct {
  productId: string;
  name: string;
  image: string | null;
  stats: {
    reviews: number;
    likes: number;
    share: number;
  };
}

export class BrandService {
  private feedService: FeedService;

  constructor() {
    this.feedService = new FeedService();
  }

  /**
   * Tüm brand kategorilerini listele
   */
  async getAllBrandCategories(): Promise<BrandCategoryItem[]> {
    try {
      // Brand.category'den distinct değerleri al
      const brands = await prisma.brand.findMany({
        where: {
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: ['category'],
      });

      // Kategorileri map'le (şu an için imageUrl yok, category string değeri kullanılıyor)
      return brands
        .filter((brand) => brand.category)
        .map((brand) => ({
          categoryId: brand.category!,
          name: brand.category!,
          image: null, // TODO: Brand category için image eklenebilir
        }));
    } catch (error) {
      logger.error('Failed to get all brand categories:', error);
      throw error;
    }
  }

  /**
   * Kategoriye göre markaları listele
   */
  async getBrandsByCategoryId(categoryId: string): Promise<BrandItem[]> {
    try {
      const brands = await prisma.brand.findMany({
        where: {
          category: categoryId,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return brands.map((brand) => ({
        brandId: brand.id,
        name: brand.name,
        image: brand.imageUrl,
      }));
    } catch (error) {
      logger.error(`Failed to get brands for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Brand catalog detayları (brand bilgisi + posts)
   */
  async getBrandCatalog(brandId: string, userId?: string): Promise<BrandCatalogResponse> {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
        },
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Followers count
      const followersCount = await prisma.bridgeFollower.count({
        where: { brandId },
      });

      // Is user following this brand?
      let isJoined = false;
      if (userId) {
        const follow = await prisma.bridgeFollower.findUnique({
          where: {
            userId_brandId: {
              userId: userId,
              brandId: brandId,
            },
          },
        });
        isJoined = !!follow;
      }

      // Get brand posts (BridgePost)
      const bridgePosts = await prisma.bridgePost.findMany({
        where: { brandId },
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
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Map bridge posts to feed items
      // BridgePost'ları ContentPost formatına dönüştürmemiz gerekiyor
      // Şimdilik basit bir mapping yapıyoruz
      const posts: FeedItem[] = bridgePosts.map((post) => {
        const userBase = {
          id: post.user.id,
          name: post.user.profile?.displayName || post.user.email || 'Anonymous',
          title: post.user.titles?.[0]?.title || '',
          avatarUrl: post.user.avatars?.[0]?.imageUrl || '',
        };

        return {
          type: FeedItemType.FEED,
          data: {
            id: post.id,
            type: FeedItemType.FEED,
            user: userBase,
            stats: {
              likes: 0,
              comments: 0,
              shares: 0,
              bookmarks: 0,
            },
            createdAt: post.createdAt.toISOString(),
            product: null,
            content: post.content,
            images: [],
          },
        };
      });

      return {
        brandId: brand.id,
        name: brand.name,
        description: brand.description,
        followers: followersCount,
        isJoined,
        posts,
      };
    } catch (error) {
      logger.error(`Failed to get brand catalog for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Markaya ait ürünleri listele (product groups'a göre gruplu)
   */
  async getBrandProducts(brandId: string): Promise<BrandProductGroup[]> {
    try {
      // Brand'a ait ürünleri bul (Product.brand field'ından)
      // Önce brand name'i al
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Brand name'e göre ürünleri bul
      const products = await prisma.product.findMany({
        where: {
          brand: brand.name,
        },
        include: {
          group: true,
          contentPosts: {
            select: {
              id: true,
              likesCount: true,
              sharesCount: true,
              favoritesCount: true,
            },
          },
        },
      });

      // Product groups'a göre grupla
      const groupsMap = new Map<string, { name: string; products: BrandProduct[] }>();

      for (const product of products) {
        const groupId = product.groupId || 'ungrouped';
        const groupName = product.group?.name || 'Ungrouped';

        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, { name: groupName, products: [] });
        }

        // Stats hesapla
        const reviews = product.contentPosts.length;
        const likes = product.contentPosts.reduce((sum, post) => sum + post.likesCount, 0);
        const shares = product.contentPosts.reduce((sum, post) => sum + (post.sharesCount || 0), 0);

        groupsMap.get(groupId)!.products.push({
          productId: product.id,
          name: product.name,
          image: product.imageUrl,
          stats: {
            reviews,
            likes,
            share: shares,
          },
        });
      }

      // Map'i array'e dönüştür
      const result: BrandProductGroup[] = Array.from(groupsMap.entries()).map(([groupId, groupData]) => ({
        productGroupId: groupId,
        productGroupName: groupData.name,
        products: groupData.products,
      }));

      return result;
    } catch (error) {
      logger.error(`Failed to get brand products for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürününe ait deneyim paylaşımlarını listele
   */
  async getBrandProductExperiences(
    brandId: string,
    productId: string,
    userId?: string
  ): Promise<FeedItem[]> {
    try {
      // Brand name'i al
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Product'ı kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new Error('Product not found or does not belong to this brand');
      }

      // Ürüne ait deneyim paylaşımlarını getir (FREE type posts)
      const posts = await prisma.contentPost.findMany({
        where: {
          productId: productId,
          type: ContentPostType.FREE,
        },
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
              group: true,
            },
          },
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(posts, userId);

      return feedItems;
    } catch (error) {
      logger.error(`Failed to get brand product experiences for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürününe ait karşılaştırma gönderilerini listele
   */
  async getBrandProductComparisons(
    brandId: string,
    productId: string,
    userId?: string
  ): Promise<FeedItem[]> {
    try {
      // Brand name'i al
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Product'ı kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new Error('Product not found or does not belong to this brand');
      }

      // Ürüne ait karşılaştırma gönderilerini getir (COMPARE type posts)
      const posts = await prisma.contentPost.findMany({
        where: {
          OR: [
            { productId: productId, type: ContentPostType.COMPARE },
            {
              comparison: {
                OR: [
                  { product1Id: productId },
                  { product2Id: productId },
                ],
              },
            },
          ],
        },
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
              group: true,
            },
          },
          comparison: {
            include: {
              product1: {
                include: {
                  group: true,
                },
              },
              product2: {
                include: {
                  group: true,
                },
              },
            },
          },
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(posts, userId);

      return feedItems;
    } catch (error) {
      logger.error(`Failed to get brand product comparisons for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürünlerine dair haberleri listele
   */
  async getBrandProductNews(
    brandId: string,
    productId: string,
    userId?: string
  ): Promise<FeedItem[]> {
    try {
      // Brand name'i al
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Product'ı kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new Error('Product not found or does not belong to this brand');
      }

      // Ürüne dair haberleri getir (şu an için tüm post tiplerini dahil ediyoruz)
      // Haberler için özel bir tip yok, feed tipinde olabilir
      const posts = await prisma.contentPost.findMany({
        where: {
          productId: productId,
          // Haberler için özel bir filtre yok, tüm post tiplerini dahil ediyoruz
        },
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
              group: true,
            },
          },
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(posts, userId);

      return feedItems;
    } catch (error) {
      logger.error(`Failed to get brand product news for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Posts'ları FeedItem'lara dönüştür
   */
  private async mapPostsToFeedItems(posts: any[], userId?: string): Promise<FeedItem[]> {
    // User inventories for benchmark isOwned check
    const inventories = userId
      ? await prisma.inventory.findMany({
          where: { userId },
          select: { productId: true },
        })
      : [];
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

    // Batch fetch images
    const postProductIds = posts.map((p) => p.productId).filter(Boolean) as string[];
    const inventoryMediaMap = new Map<string, string[]>();
    if (postProductIds.length > 0 && userId) {
      const inventoriesWithMedia = await prisma.inventory.findMany({
        where: {
          userId: userId,
          productId: { in: postProductIds },
        },
        include: {
          media: {
            where: { type: 'IMAGE' },
            select: { mediaUrl: true },
          },
        },
      });

      inventoriesWithMedia.forEach((inv) => {
        const key = `${inv.userId}-${inv.productId}`;
        inventoryMediaMap.set(key, inv.media.map((m) => m.mediaUrl));
      });
    }

    // Map posts to feed items
    return posts.map((post) => {
      const userBase = {
        id: post.user.id,
        name: post.user.profile?.displayName || post.user.email || 'Anonymous',
        title: post.user.titles?.[0]?.title || '',
        avatarUrl: post.user.avatars?.[0]?.imageUrl || '',
      };

      const stats = {
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        shares: post.sharesCount || 0,
        bookmarks: post.favoritesCount || 0,
      };

      const basePost = {
        id: post.id,
        user: userBase,
        stats,
        createdAt: post.createdAt.toISOString(),
      };

      // Get images for this post
      const postKey = `${post.userId}-${post.productId || ''}`;
      const images = inventoryMediaMap.get(postKey) || [];

      // Map based on post type
      switch (post.type) {
        case ContentPostType.FREE:
          return this.mapToPostItem(post, basePost, FeedItemType.FEED, images);
        case ContentPostType.COMPARE:
          return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
        case ContentPostType.QUESTION:
          return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images);
        case ContentPostType.TIPS:
          return this.mapToTipsAndTricksItem(post, basePost, images);
        default:
          return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
      }
    });
  }

  private getProductBase(product: any): any | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.subName || product.brand || product.group?.name || '',
      image: product.imageUrl || null,
    };
  }

  private mapToPostItem(
    post: any,
    basePost: any,
    type: FeedItemType.FEED | FeedItemType.POST | FeedItemType.QUESTION,
    images: string[] = []
  ): FeedItem {
    const product = this.getProductBase(post.product);
    return {
      type,
      data: {
        ...basePost,
        type,
        product: product,
        content: post.body,
        images,
      },
    };
  }

  private mapToBenchmarkItem(
    post: any,
    basePost: any,
    ownedProductIds: Set<string>,
    images: string[] = []
  ): FeedItem {
    const comparison = post.comparison;
    if (!comparison) {
      return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
    }

    const product1 = this.getProductBase(comparison.product1);
    const product2 = this.getProductBase(comparison.product2);

    const products: any[] = [];
    if (product1) {
      products.push({
        ...product1,
        isOwned: ownedProductIds.has(product1.id),
        choice: false,
      });
    }
    if (product2) {
      products.push({
        ...product2,
        isOwned: ownedProductIds.has(product2.id),
        choice: false,
      });
    }

    return {
      type: FeedItemType.BENCHMARK,
      data: {
        ...basePost,
        type: FeedItemType.BENCHMARK,
        products,
        content: comparison.comparisonSummary || post.body,
      },
    };
  }

  private mapToTipsAndTricksItem(post: any, basePost: any, images: string[] = []): FeedItem {
    const product = this.getProductBase(post.product);
    const tip = post.tip;
    const tag = post.tags?.[0]?.tag || post.contentPostTags?.[0]?.tag || '';

    return {
      type: FeedItemType.TIPS_AND_TRICKS,
      data: {
        ...basePost,
        type: FeedItemType.TIPS_AND_TRICKS,
        product: product,
        content: post.body,
        tag,
        images,
      },
    };
  }
}

