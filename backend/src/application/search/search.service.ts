import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { SearchData, SearchUserData, SearchBrandData, SearchProductData, SearchPagination } from '../../interfaces/search/search.dto';
import { resolveMediaUrl, getPublicMediaBaseUrl } from '../../infrastructure/config/media.config';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { NOT_SYSTEM_USER } from '../../infrastructure/config/system-users';

export type SearchTypes = Array<'user' | 'brand' | 'product'>;

export class SearchService {
  private prisma: ReturnType<typeof getPrisma>;
  private readonly cacheService: CacheService;

  constructor() {
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
  }

  private decodeCursor(cursor?: string): { user?: string; brand?: string; product?: string } {
    if (!cursor) return {};
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      return {
        user: typeof parsed.user === 'string' ? parsed.user : undefined,
        brand: typeof parsed.brand === 'string' ? parsed.brand : undefined,
        product: typeof parsed.product === 'string' ? parsed.product : undefined,
      };
    } catch {
      return {};
    }
  }

  private encodeCursor(cursors: { user?: string; brand?: string; product?: string }): string {
    return Buffer.from(JSON.stringify(cursors)).toString('base64');
  }

  async searchAll(
    keyword: string | undefined,
    limitPerType: number = 10,
    types?: SearchTypes,
    cursor?: string,
  ): Promise<SearchData> {
    const activeTypes: SearchTypes = types && types.length > 0 ? types : ['user', 'brand', 'product'];
    const trimmed = keyword?.trim() || '';
    const isDefaultMode = !keyword || trimmed.length === 0;
    const defaultLimit = 4; // Default mode'da 4'er adet
    const actualLimit = isDefaultMode ? defaultLimit : limitPerType;
    const cursorIds = this.decodeCursor(cursor);

    // Default mode: cache ile tekrarlayan isteklerde DB yükü ve timeout riski azaltılır
    if (isDefaultMode) {
      const cacheKey = `search:default:${[...activeTypes].sort().join(',')}`;
      const cached = await this.cacheService.get<SearchData>(cacheKey);
      if (cached) return cached;
    }

    const tasks: Array<Promise<unknown[]>> = [];

    // Users
    if (activeTypes.includes('user')) {
      if (isDefaultMode) {
        // Default mode: En son aktif kullanıcıları getir
        tasks.push(
          this.prisma.user.findMany({
            where: { ...NOT_SYSTEM_USER },
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
            orderBy: [
              { updatedAt: 'desc' },
            ],
            take: actualLimit,
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.user.findMany({
            where: {
              ...NOT_SYSTEM_USER,
              OR: [
                { email: { contains: trimmed, mode: 'insensitive' } },
                { profile: { is: { displayName: { contains: trimmed, mode: 'insensitive' } } } },
                { profile: { is: { userName: { contains: trimmed, mode: 'insensitive' } } } },
              ],
              ...(cursorIds.user ? { id: { lt: cursorIds.user } } : {}),
            },
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
            orderBy: [
              { updatedAt: 'desc' },
            ],
            take: actualLimit + 1,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Brands
    if (activeTypes.includes('brand')) {
      if (isDefaultMode) {
        // Default mode: Logo'ları olan popüler markaları getir (Apple, MSI, ASUS, vb.)
        // Popüler marka isimleri (öncelik sırasına göre) - case-insensitive eşleşme
        const popularBrandNames = ['Apple', 'MSI', 'ASUS', 'Samsung', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'NVIDIA', 'Intel', 'AMD'];
        
        tasks.push(
          this.prisma.brand.findMany({
            where: {
              logoUrl: { not: null }, // Sadece logo'ları olan markalar
            },
            select: {
              id: true,
              name: true,
              category: true,
              logoUrl: true,
              description: true,
            },
            take: actualLimit * 3, // Daha fazla çek ki popüler olanları seçebilelim
          }).then((brands) => {
            // Popüler markaları önceliklendir
            const sortedBrands = brands.sort((a, b) => {
              const aNameLower = a.name.toLowerCase();
              const bNameLower = b.name.toLowerCase();
              
              // Tam eşleşme veya içeriyor mu kontrol et
              const aIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return aNameLower === nameLower || aNameLower.includes(nameLower) || nameLower.includes(aNameLower);
              });
              const bIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return bNameLower === nameLower || bNameLower.includes(nameLower) || nameLower.includes(bNameLower);
              });
              
              // Popüler markalar önce gelsin
              if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
              }
              if (aIndex !== -1) return -1;
              if (bIndex !== -1) return 1;
              
              // İkisi de popüler değilse alfabetik sırala
              return a.name.localeCompare(b.name);
            });
            
            // İstenen sayıda döndür
            return sortedBrands.slice(0, actualLimit);
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.brand.findMany({
            where: {
              OR: [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { category: { contains: trimmed, mode: 'insensitive' } },
                { description: { contains: trimmed, mode: 'insensitive' } },
              ],
              ...(cursorIds.brand ? { id: { gt: cursorIds.brand } } : {}),
            },
            select: {
              id: true,
              name: true,
              category: true,
              logoUrl: true,
              description: true,
            },
            orderBy: { name: 'asc' },
            take: actualLimit + 1,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Products
    if (activeTypes.includes('product')) {
      if (isDefaultMode) {
        // Default mode: Image'ları olan popüler brand'lardan ürünleri getir
        // Popüler brand isimleri (öncelik sırasına göre)
        const popularBrandNames = ['Apple', 'MSI', 'ASUS', 'Samsung', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'NVIDIA', 'Intel', 'AMD'];
        
        tasks.push(
          this.prisma.product.findMany({
            where: {
              imageUrl: { not: null }, // Sadece image'ları olan product'lar
            },
            select: {
              id: true,
              name: true,
              brand: {
                select: {
                  name: true,
                },
              },
              description: true,
              imageUrl: true,
            },
            take: actualLimit * 3, // Daha fazla çek ki popüler olanları seçebilelim
          }).then((products) => {
            // Popüler brand'lardan gelen product'ları önceliklendir
            const sortedProducts = products.sort((a, b) => {
              const aBrandLower = (a.brand?.name || '').toLowerCase();
              const bBrandLower = (b.brand?.name || '').toLowerCase();
              
              // Tam eşleşme veya içeriyor mu kontrol et
              const aIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return aBrandLower === nameLower || aBrandLower.includes(nameLower) || nameLower.includes(aBrandLower);
              });
              const bIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return bBrandLower === nameLower || bBrandLower.includes(nameLower) || nameLower.includes(bBrandLower);
              });
              
              // Popüler brand'lardan gelen product'lar önce gelsin
              if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
              }
              if (aIndex !== -1) return -1;
              if (bIndex !== -1) return 1;
              
              // İkisi de popüler brand'dan değilse alfabetik sırala
              return a.name.localeCompare(b.name);
            });
            
            // İstenen sayıda döndür
            return sortedProducts.slice(0, actualLimit);
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { description: { contains: trimmed, mode: 'insensitive' } },
                { brand: { is: { name: { contains: trimmed, mode: 'insensitive' } } } },
              ],
              ...(cursorIds.product ? { id: { gt: cursorIds.product } } : {}),
            },
            select: {
              id: true,
              name: true,
              brand: {
                select: {
                  name: true,
                },
              },
              description: true,
              imageUrl: true,
            },
            orderBy: { name: 'asc' },
            take: actualLimit + 1,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [users, brands, products] = await Promise.all(tasks);

    // Database'deki URL veya path'i MinIO path formatına çeviren helper fonksiyon
    // Database'den sadece path gelir, path'i temizler
    const extractPath = (path: string | null): string | null => {
      if (!path) return null;
      
      // Path'i temizle (başındaki / ve tipbox-media/ prefix'ini kaldır)
      // resolveMediaUrl zaten tipbox-media/ ekleyecek
      return path.replace(/^\/+/, '').replace(/^tipbox-media\//, '');
    };

    // Path'i BASE_URL ile birleştirerek tam URL oluştur
    const buildFullUrl = (path: string | null): string | null => {
      if (!path) return null;
      // resolveMediaUrl path'e tipbox-media/ ekleyecek ve BASE_URL ile birleştirecek
      return resolveMediaUrl(path);
    };

    // Pagination: check hasMore and trim extra items (search mode only)
    const usersHasMore = !isDefaultMode && users.length > actualLimit;
    const brandsHasMore = !isDefaultMode && brands.length > actualLimit;
    const productsHasMore = !isDefaultMode && products.length > actualLimit;

    if (usersHasMore) users.splice(actualLimit);
    if (brandsHasMore) brands.splice(actualLimit);
    if (productsHasMore) products.splice(actualLimit);

    const typedUsers = users as Array<Record<string, unknown>>;
    const typedBrands = brands as Array<Record<string, unknown>>;
    const typedProducts = products as Array<Record<string, unknown>>;

    const userData: SearchUserData[] = typedUsers.map((u) => {
      const avatars = u?.avatars as Array<{ imageUrl?: string }> | undefined;
      const profile = u?.profile as { displayName?: string; userName?: string } | undefined;
      const titles = u?.titles as Array<{ title?: string }> | undefined;
      const rawAvatarUrl = avatars?.[0]?.imageUrl || null;
      const avatarPath = extractPath(rawAvatarUrl);
      return {
        id: String(u.id),
        name: profile?.displayName || String(u?.email || 'Anonymous'),
        avatar: buildFullUrl(avatarPath),
        cosmetic: titles?.[0]?.title || '', // fallback: last earned title or empty
      };
    });

    const brandData: SearchBrandData[] = typedBrands.map((b) => {
      const rawLogoUrl = (b.logoUrl as string) || null;
      const logoPath = extractPath(rawLogoUrl);
      return {
        id: String(b.id),
        name: String(b.name),
        category: (b.category as string) || null,
        logo: buildFullUrl(logoPath),
      };
    });

    const productData: SearchProductData[] = typedProducts.map((p) => {
      const rawImageUrl = (p.imageUrl as string) || null;
      const imagePath = extractPath(rawImageUrl);
      const brand = p.brand as { name?: string } | undefined;
      return {
        id: String(p.id),
        name: String(p.name),
        model: brand?.name || '',
        specs: String(p.description || ''),
        image: buildFullUrl(imagePath),
      };
    });

    const hasMore = usersHasMore || brandsHasMore || productsHasMore;

    const pagination: SearchPagination = {
      hasMore,
      limit: actualLimit,
    };

    if (hasMore) {
      const nextCursor: { user?: string; brand?: string; product?: string } = {};
      if (usersHasMore && userData.length > 0) nextCursor.user = userData[userData.length - 1].id;
      if (brandsHasMore && brandData.length > 0) nextCursor.brand = brandData[brandData.length - 1].id;
      if (productsHasMore && productData.length > 0) nextCursor.product = productData[productData.length - 1].id;
      pagination.cursor = this.encodeCursor(nextCursor);
    }

    const result: SearchData = { userData, brandData, productData, pagination };

    if (isDefaultMode) {
      const cacheKey = `search:default:${[...activeTypes].sort().join(',')}`;
      await this.cacheService.set(cacheKey, result, CACHE_TTL.SEARCH_DEFAULT);
    }

    return result;
  }
}


